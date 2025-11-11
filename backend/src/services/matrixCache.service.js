'use strict';

const axios = require('axios');
const Redis = require('ioredis');
const crypto = require('crypto');

class MatrixCacheService {
  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[MatrixCache] Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3
    });

    this.osrmBase = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';
    this.cacheTTL = 300; // 5 minutes cache
    this.enabled = true;

    this.redis.on('error', (err) => {
      console.error('[MatrixCache] Redis error:', err.message);
      this.enabled = false;
    });

    this.redis.on('connect', () => {
      console.log('[MatrixCache] Connected to Redis');
      this.enabled = true;
    });
  }

  /**
   * Generate cache key from coordinates
   */
  _keyFor(coords) {
    const raw = coords
      .map(c => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`)
      .join(';');
    return 'mx:' + crypto.createHash('sha1').update(raw).digest('hex');
  }

  /**
   * Get distance/duration matrix with Redis caching
   * @param {Array<{lat, lng}>} coords - Array of coordinates
   * @returns {Promise<{distances: number[][], durations: number[][]}>}
   */
  async getMatrix(coords) {
    if (!coords || coords.length === 0) {
      throw new Error('Coordinates array cannot be empty');
    }

    if (coords.length === 1) {
      // Single point - return zero matrix
      return {
        distances: [[0]],
        durations: [[0]]
      };
    }

    const key = this._keyFor(coords);

    // Try cache first
    if (this.enabled) {
      try {
        const hit = await this.redis.get(key);
        if (hit) {
          return JSON.parse(hit);
        }
      } catch (err) {
        console.warn('[MatrixCache] Cache read error:', err.message);
      }
    }

    // Cache miss - fetch from OSRM
    try {
      const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
      const url = `${this.osrmBase}/table/v1/driving/${coordStr}?annotations=duration,distance`;

      const { data } = await axios.get(url, { timeout: 20000 });

      if (data.code !== 'Ok') {
        throw new Error(`OSRM error: ${data.message || data.code}`);
      }

      const result = {
        distances: data.distances,
        durations: data.durations
      };

      // Cache result
      if (this.enabled) {
        try {
          await this.redis.setex(key, this.cacheTTL, JSON.stringify(result));
        } catch (err) {
          console.warn('[MatrixCache] Cache write error:', err.message);
        }
      }

      return result;
    } catch (error) {
      console.error('[MatrixCache] OSRM request failed:', error.message);

      // Fallback: return simple euclidean distance matrix
      return this._fallbackMatrix(coords);
    }
  }

  /**
   * Fallback matrix using haversine distance
   */
  _fallbackMatrix(coords) {
    const n = coords.length;
    const distances = Array.from({ length: n }, () => Array(n).fill(0));
    const durations = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const dist = this._haversine(coords[i], coords[j]);
          distances[i][j] = dist; // km
          durations[i][j] = (dist / 30) * 3600; // assume 30 km/h, return seconds
        }
      }
    }

    return { distances, durations };
  }

  /**
   * Haversine distance in kilometers
   */
  _haversine(coord1, coord2) {
    const R = 6371; // Earth radius in km
    const dLat = this._toRad(coord2.lat - coord1.lat);
    const dLon = this._toRad(coord2.lng - coord1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRad(coord1.lat)) *
        Math.cos(this._toRad(coord2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  _toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /**
   * Clear matrix cache
   */
  async clearCache() {
    if (!this.enabled) return;
    try {
      const keys = await this.redis.keys('mx:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return { cleared: keys.length };
    } catch (err) {
      console.error('[MatrixCache] Clear cache error:', err.message);
      return { error: err.message };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.enabled) {
      return { enabled: false, keys: 0 };
    }

    try {
      const keys = await this.redis.keys('mx:*');
      return {
        enabled: true,
        keys: keys.length,
        ttl: this.cacheTTL
      };
    } catch (err) {
      return { enabled: false, error: err.message };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
  }
}

// Singleton instance
let instance = null;

function getMatrixCacheService() {
  if (!instance) {
    instance = new MatrixCacheService();
  }
  return instance;
}

// Convenience function for direct matrix fetch
async function getMatrix(coords) {
  const service = getMatrixCacheService();
  return service.getMatrix(coords);
}

module.exports = {
  MatrixCacheService,
  getMatrixCacheService,
  getMatrix
};
