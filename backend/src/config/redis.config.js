/**
 * Redis Configuration (Production Implementation)
 * Redis client with connection pooling, reconnection, and error handling
 */

const redis = require('redis');
const { logger } = require('../utils/logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnecting = false;
    this.initialize();
  }

  /**
   * Initialize Redis client
   */
  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL;

      // If no Redis URL provided, use in-memory fallback immediately
      if (!redisUrl) {
        logger.info('[Redis] No REDIS_URL provided, using in-memory fallback');
        return this.useFallback();
      }

      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('[Redis] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            // Exponential backoff: 100ms, 200ms, 400ms, etc.
            const delay = Math.min(retries * 100, 3000);
            logger.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
        },
      });

      // Event handlers
      this.client.on('connect', () => {
        logger.info('[Redis] Connecting to Redis server...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.reconnecting = false;
        logger.info('[Redis] Connected and ready');
      });

      this.client.on('error', (err) => {
        logger.error('[Redis] Client error', { error: err.message });
      });

      this.client.on('reconnecting', () => {
        this.reconnecting = true;
        logger.warn('[Redis] Reconnecting...');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.warn('[Redis] Connection closed');
      });

      // Connect to Redis
      await this.client.connect();

      logger.info('[Redis] Production client initialized');
    } catch (error) {
      logger.error('[Redis] Failed to initialize', { error: error.message });
      // Fallback to in-memory if Redis connection fails
      this.useFallback();
    }
  }

  /**
   * Fallback to in-memory storage when Redis is unavailable
   */
  useFallback() {
    logger.warn('[Redis] Using in-memory fallback');
    this.store = new Map();
    this.expirations = new Map();
    this.isConnected = false;
    this.isFallback = true;
  }

  /**
   * Set a key with expiration
   */
  async setex(key, ttl, value) {
    try {
      if (this.isFallback) {
        return this._fallbackSetex(key, ttl, value);
      }
      await this.client.setEx(key, ttl, value);
    } catch (error) {
      logger.error('[Redis] SETEX failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get a key's value
   */
  async get(key) {
    try {
      if (this.isFallback) {
        return this._fallbackGet(key);
      }
      return await this.client.get(key);
    } catch (error) {
      logger.error('[Redis] GET failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key) {
    try {
      if (this.isFallback) {
        return this._fallbackDel(key);
      }
      await this.client.del(key);
    } catch (error) {
      logger.error('[Redis] DEL failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Set a key (no expiration)
   */
  async set(key, value) {
    try {
      if (this.isFallback) {
        return this._fallbackSet(key, value);
      }
      await this.client.set(key, value);
    } catch (error) {
      logger.error('[Redis] SET failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (this.isFallback) {
        return this._fallbackExists(key);
      }
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('[Redis] EXISTS failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern) {
    try {
      if (this.isFallback) {
        return this._fallbackKeys(pattern);
      }
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('[Redis] KEYS failed', { pattern, error: error.message });
      return [];
    }
  }

  /**
   * Clear all data
   */
  async flushall() {
    try {
      if (this.isFallback) {
        return this._fallbackFlushall();
      }
      await this.client.flushAll();
    } catch (error) {
      logger.error('[Redis] FLUSHALL failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      logger.info('[Redis] Connection closed gracefully');
    }
  }

  // Fallback methods (in-memory implementation)
  _fallbackSetex(key, ttl, value) {
    this.store.set(key, value);
    if (this.expirations.has(key)) {
      clearTimeout(this.expirations.get(key));
    }
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.expirations.delete(key);
    }, ttl * 1000);
    this.expirations.set(key, timeout);
  }

  _fallbackGet(key) {
    return this.store.get(key) || null;
  }

  _fallbackDel(key) {
    if (this.expirations.has(key)) {
      clearTimeout(this.expirations.get(key));
      this.expirations.delete(key);
    }
    this.store.delete(key);
  }

  _fallbackSet(key, value) {
    this.store.set(key, value);
  }

  _fallbackExists(key) {
    return this.store.has(key);
  }

  _fallbackKeys(pattern) {
    return Array.from(this.store.keys());
  }

  _fallbackFlushall() {
    for (const timeout of this.expirations.values()) {
      clearTimeout(timeout);
    }
    this.store.clear();
    this.expirations.clear();
  }
}

// Export singleton instance
const redisClient = new RedisClient();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await redisClient.close();
});

process.on('SIGINT', async () => {
  await redisClient.close();
});

module.exports = redisClient;
