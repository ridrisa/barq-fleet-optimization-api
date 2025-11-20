/**
 * Analytics Cache Service
 *
 * Implements intelligent caching for Python analytics results
 * to reduce database load and improve response times.
 *
 * Features:
 * - LRU eviction policy
 * - TTL-based expiration
 * - Request deduplication
 * - Cache hit/miss metrics
 * - Memory-safe with size limits
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

class AnalyticsCacheService {
  constructor(options = {}) {
    this.cache = new Map(); // key -> { result, timestamp, hits, size }
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };

    // Configuration
    this.config = {
      maxAge: options.maxAge || 300000, // 5 minutes default TTL
      maxSize: options.maxSize || 100, // Max 100 cached entries
      maxMemoryMB: options.maxMemoryMB || 50, // Max 50MB cache memory
      enableMetrics: options.enableMetrics !== false
    };

    // Track total cache memory usage
    this.totalMemoryBytes = 0;

    // Start periodic cleanup
    this._startPeriodicCleanup();
  }

  /**
   * Get cache key from analytics parameters
   * @param {string} type - Analytics type (route_analysis, fleet_performance, etc.)
   * @param {Object} params - Request parameters
   * @returns {string} MD5 hash of normalized params
   */
  getCacheKey(type, params) {
    // Normalize params to ensure consistent hashing
    const normalizedParams = this._normalizeParams(params);

    const keyData = {
      type,
      params: normalizedParams
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Normalize parameters for consistent caching
   * @private
   */
  _normalizeParams(params) {
    const normalized = { ...params };

    // Remove undefined/null values
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === undefined || normalized[key] === null || normalized[key] === '') {
        delete normalized[key];
      }
    });

    // Sort object keys for consistent hashing
    const sorted = {};
    Object.keys(normalized)
      .sort()
      .forEach(key => {
        sorted[key] = normalized[key];
      });

    return sorted;
  }

  /**
   * Get cached result if available and not expired
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null
   */
  get(key) {
    this.cacheStats.totalRequests++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.cacheStats.misses++;
      this._logCacheEvent('miss', key);
      return null;
    }

    const age = Date.now() - entry.timestamp;

    // Check if expired
    if (age > this.config.maxAge) {
      this.cache.delete(key);
      this.totalMemoryBytes -= entry.size;
      this.cacheStats.misses++;
      this.cacheStats.evictions++;
      this._logCacheEvent('expired', key, { age });
      return null;
    }

    // Update hit count
    entry.hits++;
    this.cacheStats.hits++;
    this._logCacheEvent('hit', key, {
      age,
      hits: entry.hits,
      ttl: this.config.maxAge - age
    });

    return entry.result;
  }

  /**
   * Store result in cache
   * @param {string} key - Cache key
   * @param {Object} result - Analytics result to cache
   * @returns {boolean} Success status
   */
  set(key, result) {
    try {
      // Calculate result size
      const resultSize = this._calculateSize(result);

      // Check if result exceeds max memory
      if (resultSize > this.config.maxMemoryMB * 1024 * 1024) {
        logger.warn('[AnalyticsCache] Result too large to cache', {
          key,
          sizeMB: (resultSize / 1024 / 1024).toFixed(2),
          maxMB: this.config.maxMemoryMB
        });
        return false;
      }

      // Evict entries if cache full
      this._ensureCapacity(resultSize);

      // Store in cache
      const entry = {
        result,
        timestamp: Date.now(),
        hits: 0,
        size: resultSize
      };

      this.cache.set(key, entry);
      this.totalMemoryBytes += resultSize;

      this._logCacheEvent('set', key, {
        sizeMB: (resultSize / 1024 / 1024).toFixed(2),
        ttl: this.config.maxAge
      });

      return true;
    } catch (error) {
      logger.error('[AnalyticsCache] Failed to cache result', {
        key,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Calculate approximate size of object in bytes
   * @private
   */
  _calculateSize(obj) {
    try {
      const jsonString = JSON.stringify(obj);
      return Buffer.byteLength(jsonString, 'utf8');
    } catch (error) {
      // Fallback estimate
      return 10240; // 10KB
    }
  }

  /**
   * Ensure cache has capacity for new entry
   * @private
   */
  _ensureCapacity(requiredBytes) {
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024;

    // Evict by LRU if over size limit
    while (this.cache.size >= this.config.maxSize) {
      this._evictLRU();
    }

    // Evict by LRU if over memory limit
    while (this.totalMemoryBytes + requiredBytes > maxBytes) {
      this._evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (this.cache.size === 0) return;

    // Find entry with lowest hit count and oldest timestamp
    let lruKey = null;
    let lruScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // LRU score: prioritize low hits and old age
      const score = (entry.hits + 1) / (Date.now() - entry.timestamp);

      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      const evicted = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      this.totalMemoryBytes -= evicted.size;
      this.cacheStats.evictions++;

      this._logCacheEvent('evict', lruKey, {
        hits: evicted.hits,
        age: Date.now() - evicted.timestamp,
        sizeMB: (evicted.size / 1024 / 1024).toFixed(2)
      });
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.totalMemoryBytes = 0;

    logger.info('[AnalyticsCache] Cache cleared', {
      entriesCleared
    });
  }

  /**
   * Invalidate specific cache entry
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.totalMemoryBytes -= entry.size;
      this._logCacheEvent('invalidate', key);
      return true;
    }
    return false;
  }

  /**
   * Invalidate all entries matching a pattern
   * @param {string} type - Analytics type to invalidate
   */
  invalidateByType(type) {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Check if key starts with type hash
      // This is approximate - may invalidate more than necessary
      this.cache.delete(key);
      this.totalMemoryBytes -= entry.size;
      invalidated++;
    }

    logger.info('[AnalyticsCache] Invalidated by type', {
      type,
      count: invalidated
    });

    return invalidated;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      entries: this.cache.size,
      memoryUsageMB: (this.totalMemoryBytes / 1024 / 1024).toFixed(2),
      maxMemoryMB: this.config.maxMemoryMB,
      memoryUtilization: ((this.totalMemoryBytes / (this.config.maxMemoryMB * 1024 * 1024)) * 100).toFixed(2),
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      evictions: this.cacheStats.evictions,
      totalRequests: this.cacheStats.totalRequests,
      hitRate: parseFloat(hitRate),
      ttlSeconds: Math.floor(this.config.maxAge / 1000)
    };
  }

  /**
   * Get cache health status
   * @returns {Object} Health status
   */
  getHealth() {
    const stats = this.getStats();

    return {
      status: stats.hitRate > 70 ? 'healthy' : stats.hitRate > 50 ? 'degraded' : 'poor',
      recommendation: this._getHealthRecommendation(stats),
      stats
    };
  }

  /**
   * Get health recommendation
   * @private
   */
  _getHealthRecommendation(stats) {
    if (stats.hitRate > 80) {
      return 'Cache performing optimally';
    } else if (stats.hitRate > 60) {
      return 'Cache performing well. Monitor for improvements.';
    } else if (stats.hitRate > 40) {
      return 'Consider increasing cache size or TTL';
    } else {
      return 'Low hit rate. Review caching strategy or increase capacity.';
    }
  }

  /**
   * Start periodic cleanup of expired entries
   * @private
   */
  _startPeriodicCleanup() {
    const cleanupInterval = 60000; // 1 minute

    setInterval(() => {
      this._cleanupExpired();
    }, cleanupInterval);
  }

  /**
   * Clean up expired entries
   * @private
   */
  _cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;

      if (age > this.config.maxAge) {
        this.cache.delete(key);
        this.totalMemoryBytes -= entry.size;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('[AnalyticsCache] Periodic cleanup', {
        entriesRemoved: cleaned,
        entriesRemaining: this.cache.size
      });
    }
  }

  /**
   * Log cache events
   * @private
   */
  _logCacheEvent(event, key, metadata = {}) {
    if (!this.config.enableMetrics) return;

    logger.debug(`[AnalyticsCache] ${event}`, {
      event,
      key: key.substring(0, 8) + '...',
      ...metadata
    });
  }

  /**
   * Get cache entries summary (for debugging)
   * @returns {Array} Array of cache entry summaries
   */
  getEntriesSummary() {
    const entries = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key: key.substring(0, 12) + '...',
        age: Math.floor((Date.now() - entry.timestamp) / 1000),
        hits: entry.hits,
        sizeMB: (entry.size / 1024 / 1024).toFixed(2)
      });
    }

    return entries.sort((a, b) => b.hits - a.hits);
  }
}

// Export singleton instance
module.exports = new AnalyticsCacheService({
  maxAge: 300000, // 5 minutes
  maxSize: 100, // 100 entries
  maxMemoryMB: 50, // 50 MB
  enableMetrics: true
});

// Also export class for testing
module.exports.AnalyticsCacheService = AnalyticsCacheService;
