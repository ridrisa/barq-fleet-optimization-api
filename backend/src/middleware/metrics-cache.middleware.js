/**
 * In-Memory Caching Middleware for Production Metrics
 *
 * Purpose: Bypass slow GROUP BY queries by caching results for 5 minutes
 *
 * Why This is Needed:
 * - Production metrics queries use COUNT(*) FILTER(WHERE ...) aggregations
 * - These queries must scan ALL matching rows before applying LIMIT
 * - Even with indexes and 6-hour windows, queries timeout (>10 seconds)
 * - Fifth and sixth deployments confirmed query optimization approach failed
 *
 * Architecture:
 * - Simple in-memory cache using JavaScript Map
 * - TTL: 5 minutes (300 seconds)
 * - Cache key includes: endpoint path + query parameters
 * - No external dependencies (Redis not needed for this scale)
 *
 * Trade-offs:
 * - Data freshness: Up to 5 minutes stale
 * - Memory: ~1-2MB for all metrics (negligible)
 * - Simplicity: No Redis infrastructure needed
 *
 * Production Safety:
 * - Memory cleanup runs every minute
 * - Fails gracefully if cache is full
 * - Logs cache hits/misses for monitoring
 */

const { logger } = require('../utils/logger');

// In-memory cache storage
const cache = new Map();

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Generate cache key from request
 * @param {Object} req - Express request object
 * @returns {string} Cache key
 */
function getCacheKey(req) {
  const path = req.path;
  const queryString = JSON.stringify(req.query);
  return `${path}:${queryString}`;
}

/**
 * Check if cached response is still valid
 * @param {Object} cacheEntry - Cached entry with data and timestamp
 * @returns {boolean} True if cache is still valid
 */
function isCacheValid(cacheEntry) {
  if (!cacheEntry) return false;
  const age = Date.now() - cacheEntry.timestamp;
  return age < CACHE_TTL_MS;
}

/**
 * Clean up expired cache entries
 * Runs periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, entry] of cache.entries()) {
    const age = now - entry.timestamp;
    if (age >= CACHE_TTL_MS) {
      cache.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.info(`Metrics cache cleanup: removed ${removedCount} expired entries`);
  }
}

// Start cleanup interval
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

/**
 * Metrics caching middleware
 * Caches successful responses for production metrics endpoints
 */
function metricsCacheMiddleware(req, res, next) {
  const cacheKey = getCacheKey(req);
  const cachedEntry = cache.get(cacheKey);

  // Check if we have a valid cached response
  if (isCacheValid(cachedEntry)) {
    logger.info(`✅ Metrics cache HIT: ${req.path}`);

    // Add cache headers to response
    res.set({
      'X-Cache': 'HIT',
      'X-Cache-Age': Math.floor((Date.now() - cachedEntry.timestamp) / 1000),
      'X-Cache-TTL': Math.floor(CACHE_TTL_MS / 1000),
    });

    // Return cached response
    return res.status(200).json(cachedEntry.data);
  }

  // Cache miss - intercept res.json to cache the response
  logger.info(`⚠️  Metrics cache MISS: ${req.path}`);

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Only cache successful responses
    if (res.statusCode === 200 && data && data.success !== false) {
      try {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
        logger.info(`💾 Cached metrics response: ${req.path}`);
      } catch (error) {
        logger.error('Error caching metrics response:', error);
      }
    }

    // Add cache headers
    res.set({
      'X-Cache': 'MISS',
      'X-Cache-TTL': Math.floor(CACHE_TTL_MS / 1000),
    });

    // Call original json method
    return originalJson(data);
  };

  next();
}

/**
 * Get cache statistics for monitoring
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of cache.values()) {
    const age = now - entry.timestamp;
    if (age < CACHE_TTL_MS) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries,
    ttlSeconds: CACHE_TTL_MS / 1000,
  };
}

/**
 * Clear all cache entries (for testing/manual intervention)
 */
function clearCache() {
  const count = cache.size;
  cache.clear();
  logger.info(`Cleared ${count} cache entries`);
  return { cleared: count };
}

module.exports = {
  metricsCacheMiddleware,
  getCacheStats,
  clearCache,
};
