/**
 * Cache Service - In-Memory Caching
 * Provides high-performance caching with automatic TTL management
 */

const NodeCache = require('node-cache');
const { logger } = require('../utils/logger');
const metricsService = require('./metrics.service');

class CacheService {
  constructor() {
    // Main application cache
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: true, // Clone objects to prevent mutation
      deleteOnExpire: true,
      maxKeys: 10000, // Prevent memory overflow
    });

    // Optimization results cache (longer TTL)
    this.optimizationCache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 180,
      useClones: true,
      deleteOnExpire: true,
      maxKeys: 1000,
    });

    // Agent results cache
    this.agentCache = new NodeCache({
      stdTTL: 180, // 3 minutes
      checkperiod: 60,
      useClones: true,
      deleteOnExpire: true,
      maxKeys: 500,
    });

    // Static data cache (very long TTL)
    this.staticCache = new NodeCache({
      stdTTL: 3600, // 1 hour
      checkperiod: 600,
      useClones: true,
      deleteOnExpire: true,
      maxKeys: 200,
    });

    this.setupEventListeners();
    this.startMetricsCollection();

    logger.info('Cache service initialized with multiple cache layers');
  }

  /**
   * Set up event listeners for monitoring
   */
  setupEventListeners() {
    // Track cache hits and misses through get operations
    // Since node-cache doesn't emit hit/miss events, we'll track in our methods

    // Track expired keys
    this.cache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { cache: 'main', key });
    });

    this.optimizationCache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { cache: 'optimization', key });
    });

    this.agentCache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { cache: 'agent', key });
    });

    this.staticCache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { cache: 'static', key });
    });

    // Track errors
    this.cache.on('error', (error) => {
      logger.error('Cache error', { cache: 'main', error: error.message });
    });
  }

  /**
   * Start collecting metrics periodically
   */
  startMetricsCollection() {
    setInterval(() => {
      try {
        const stats = this.getStats();

        // Update metrics for main cache
        metricsService.updateCacheSize('main', this.estimateCacheSize(this.cache));
        metricsService.updateCacheSize(
          'optimization',
          this.estimateCacheSize(this.optimizationCache)
        );
        metricsService.updateCacheSize('agent', this.estimateCacheSize(this.agentCache));
        metricsService.updateCacheSize('static', this.estimateCacheSize(this.staticCache));
      } catch (error) {
        logger.error('Error collecting cache metrics', { error: error.message });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Estimate cache size in bytes (rough approximation)
   */
  estimateCacheSize(cache) {
    try {
      const keys = cache.keys();
      let totalSize = 0;

      keys.forEach((key) => {
        const value = cache.get(key);
        if (value) {
          totalSize += JSON.stringify(value).length;
        }
      });

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get value from main cache
   */
  get(key, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      const value = cache.get(key);

      if (value !== undefined) {
        metricsService.trackCacheHit(cacheName);
        logger.debug('Cache hit', { cache: cacheName, key });
        return value;
      }

      metricsService.trackCacheMiss(cacheName);
      logger.debug('Cache miss', { cache: cacheName, key });
      return undefined;
    } catch (error) {
      logger.error('Cache get error', { cache: cacheName, key, error: error.message });
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      const success = cache.set(key, value, ttl);

      if (success) {
        logger.debug('Cache set', { cache: cacheName, key, ttl: ttl || 'default' });
      } else {
        logger.warn('Cache set failed', { cache: cacheName, key });
      }

      return success;
    } catch (error) {
      logger.error('Cache set error', { cache: cacheName, key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  del(key, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      const count = cache.del(key);
      logger.debug('Cache delete', { cache: cacheName, key, deleted: count > 0 });
      return count > 0;
    } catch (error) {
      logger.error('Cache delete error', { cache: cacheName, key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  delMultiple(keys, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      const count = cache.del(keys);
      logger.debug('Cache multi-delete', {
        cache: cacheName,
        keysCount: keys.length,
        deleted: count,
      });
      return count;
    } catch (error) {
      logger.error('Cache multi-delete error', { cache: cacheName, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  has(key, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      return cache.has(key);
    } catch (error) {
      logger.error('Cache has error', { cache: cacheName, key, error: error.message });
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  getTtl(key, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      return cache.getTtl(key);
    } catch (error) {
      logger.error('Cache getTtl error', { cache: cacheName, key, error: error.message });
      return undefined;
    }
  }

  /**
   * Update TTL for a key
   */
  setTtl(key, ttl, cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      return cache.ttl(key, ttl);
    } catch (error) {
      logger.error('Cache setTtl error', { cache: cacheName, key, error: error.message });
      return false;
    }
  }

  /**
   * Get all keys
   */
  keys(cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      return cache.keys();
    } catch (error) {
      logger.error('Cache keys error', { cache: cacheName, error: error.message });
      return [];
    }
  }

  /**
   * Flush specific cache
   */
  flush(cacheName = 'main') {
    try {
      const cache = this.getCache(cacheName);
      cache.flushAll();
      logger.info('Cache flushed', { cache: cacheName });
      return true;
    } catch (error) {
      logger.error('Cache flush error', { cache: cacheName, error: error.message });
      return false;
    }
  }

  /**
   * Flush all caches
   */
  flushAll() {
    try {
      this.cache.flushAll();
      this.optimizationCache.flushAll();
      this.agentCache.flushAll();
      this.staticCache.flushAll();
      logger.info('All caches flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush all error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(cacheName) {
    try {
      if (cacheName) {
        const cache = this.getCache(cacheName);
        return cache.getStats();
      }

      return {
        main: this.cache.getStats(),
        optimization: this.optimizationCache.getStats(),
        agent: this.agentCache.getStats(),
        static: this.staticCache.getStats(),
      };
    } catch (error) {
      logger.error('Cache getStats error', { error: error.message });
      return null;
    }
  }

  /**
   * Get cache instance by name
   */
  getCache(cacheName) {
    switch (cacheName) {
      case 'optimization':
        return this.optimizationCache;
      case 'agent':
        return this.agentCache;
      case 'static':
        return this.staticCache;
      case 'main':
      default:
        return this.cache;
    }
  }

  /**
   * Wrapper for cached function execution
   * Executes function and caches result, or returns cached result if available
   */
  async getCached(key, fetchFunction, options = {}) {
    const { ttl = 300, cacheName = 'main', forceRefresh = false } = options;

    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cached = this.get(key, cacheName);
        if (cached !== undefined) {
          return cached;
        }
      }

      // Execute function to get data
      const data = await fetchFunction();

      // Cache the result
      if (data !== undefined && data !== null) {
        this.set(key, data, ttl, cacheName);
      }

      return data;
    } catch (error) {
      logger.error('getCached error', {
        key,
        cacheName,
        error: error.message,
      });

      // Try to return stale cache on error
      const stale = this.get(key, cacheName);
      if (stale !== undefined) {
        logger.warn('Returning stale cache due to error', { key, cacheName });
        return stale;
      }

      throw error;
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join('|');

    return `${prefix}:${sortedParams}`;
  }

  /**
   * Close all caches
   */
  close() {
    try {
      this.cache.close();
      this.optimizationCache.close();
      this.agentCache.close();
      this.staticCache.close();
      logger.info('All caches closed');
    } catch (error) {
      logger.error('Error closing caches', { error: error.message });
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
