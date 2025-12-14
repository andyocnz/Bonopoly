/**
 * Local Storage Cache Service
 *
 * Provides fast, offline-capable caching layer for Google Sheets data
 * with automatic sync, TTL, and conflict resolution
 */

import { debugLogger } from './debugLogger';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: number; // For conflict detection
}

interface SyncQueueItem {
  id: string;
  action: 'write' | 'update';
  sheet: string;
  data: any;
  filters?: any;
  timestamp: number;
  retries: number;
}

const CACHE_PREFIX = 'bonopoly_cache_';
const SYNC_QUEUE_KEY = 'bonopoly_sync_queue';
const MAX_RETRIES = 3;

/**
 * Cache TTL configurations (in milliseconds)
 */
export const CACHE_TTL = {
  GAME: 5 * 60 * 1000, // 5 minutes - game settings change rarely
  TEAMS: 10 * 60 * 1000, // 10 minutes - teams rarely change
  SCENARIOS: 60 * 60 * 1000, // 1 hour - scenarios never change
  DECISIONS_CURRENT: 30 * 1000, // 30 seconds - need fresh data for monitoring
  DECISIONS_HISTORICAL: 60 * 60 * 1000, // 1 hour - historical data is immutable
  OUTPUTS_CURRENT: 1 * 60 * 1000, // 1 minute - results change when calculated
  OUTPUTS_HISTORICAL: 60 * 60 * 1000, // 1 hour - historical results are immutable
  DEFAULT: 2 * 60 * 1000, // 2 minutes default
};

export class CacheService {
  /**
   * Generate cache key
   */
  private static getCacheKey(sheet: string, filters?: Record<string, any>): string {
    const filterStr = filters ? JSON.stringify(filters) : 'all';
    return `${CACHE_PREFIX}${sheet}_${filterStr}`;
  }

  /**
   * Set cache entry
   */
  static set<T>(
    sheet: string,
    data: T,
    filters?: Record<string, any>,
    ttl: number = CACHE_TTL.DEFAULT
  ): void {
    try {
      const key = this.getCacheKey(sheet, filters);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        version: 1,
      };

      localStorage.setItem(key, JSON.stringify(entry));
      debugLogger.logInfo(`[Cache] SET: ${key}`, { ttl: `${ttl / 1000}s` });
    } catch (error) {
      debugLogger.logError('[Cache] Failed to set cache', error);
      // If localStorage is full, clear old entries
      this.clearExpired();
    }
  }

  /**
   * Get cache entry (returns null if expired or not found)
   */
  static get<T>(sheet: string, filters?: Record<string, any>): T | null {
    try {
      const key = this.getCacheKey(sheet, filters);
      const cached = localStorage.getItem(key);

      if (!cached) {
        debugLogger.logInfo(`[Cache] MISS: ${key}`);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;

      // Check if expired
      if (age > entry.ttl) {
        debugLogger.logInfo(`[Cache] EXPIRED: ${key}`, { age: `${age / 1000}s` });
        localStorage.removeItem(key);
        return null;
      }

      debugLogger.logInfo(`[Cache] HIT: ${key}`, { age: `${age / 1000}s` });
      return entry.data;
    } catch (error) {
      debugLogger.logError('[Cache] Failed to get cache', error);
      return null;
    }
  }

  /**
   * Invalidate specific cache entry
   */
  static invalidate(sheet: string, filters?: Record<string, any>): void {
    try {
      const key = this.getCacheKey(sheet, filters);
      localStorage.removeItem(key);
      debugLogger.logInfo(`[Cache] INVALIDATED: ${key}`);
    } catch (error) {
      debugLogger.logError('[Cache] Failed to invalidate cache', error);
    }
  }

  /**
   * Invalidate all cache entries for a sheet
   */
  static invalidateSheet(sheet: string): void {
    try {
      const keys = Object.keys(localStorage);
      const prefix = `${CACHE_PREFIX}${sheet}_`;

      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });

      debugLogger.logInfo(`[Cache] INVALIDATED SHEET: ${sheet}`);
    } catch (error) {
      debugLogger.logError('[Cache] Failed to invalidate sheet cache', error);
    }
  }

  /**
   * Clear all cache entries
   */
  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      debugLogger.logInfo('[Cache] CLEARED ALL');
    } catch (error) {
      debugLogger.logError('[Cache] Failed to clear all cache', error);
    }
  }

  /**
   * Clear expired entries
   */
  static clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;

      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const entry: CacheEntry = JSON.parse(localStorage.getItem(key)!);
            const age = Date.now() - entry.timestamp;

            if (age > entry.ttl) {
              localStorage.removeItem(key);
              cleared++;
            }
          } catch {
            // Invalid entry, remove it
            localStorage.removeItem(key);
            cleared++;
          }
        }
      });

      if (cleared > 0) {
        debugLogger.logInfo(`[Cache] CLEARED ${cleared} expired entries`);
      }
    } catch (error) {
      debugLogger.logError('[Cache] Failed to clear expired cache', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    totalEntries: number;
    totalSize: number;
    entries: Array<{ key: string; age: number; size: number }>;
  } {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));

    let totalSize = 0;
    const entries = cacheKeys.map((key) => {
      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;
      totalSize += size;

      try {
        const entry: CacheEntry = JSON.parse(value);
        return {
          key: key.replace(CACHE_PREFIX, ''),
          age: Date.now() - entry.timestamp,
          size,
        };
      } catch {
        return { key, age: 0, size };
      }
    });

    return {
      totalEntries: cacheKeys.length,
      totalSize,
      entries,
    };
  }
}

/**
 * Sync Queue Service
 * Manages background sync of write operations
 */
export class SyncQueue {
  /**
   * Add item to sync queue
   */
  static add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): void {
    try {
      const queue = this.getQueue();
      const newItem: SyncQueueItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        retries: 0,
      };

      queue.push(newItem);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      debugLogger.logInfo('[SyncQueue] Added item', newItem);
    } catch (error) {
      debugLogger.logError('[SyncQueue] Failed to add item', error);
    }
  }

  /**
   * Get all pending sync items
   */
  static getQueue(): SyncQueueItem[] {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      debugLogger.logError('[SyncQueue] Failed to get queue', error);
      return [];
    }
  }

  /**
   * Remove item from queue
   */
  static remove(id: string): void {
    try {
      const queue = this.getQueue();
      const filtered = queue.filter((item) => item.id !== id);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
      debugLogger.logInfo(`[SyncQueue] Removed item: ${id}`);
    } catch (error) {
      debugLogger.logError('[SyncQueue] Failed to remove item', error);
    }
  }

  /**
   * Increment retry count
   */
  static incrementRetry(id: string): boolean {
    try {
      const queue = this.getQueue();
      const item = queue.find((i) => i.id === id);

      if (!item) return false;

      item.retries++;

      if (item.retries >= MAX_RETRIES) {
        debugLogger.logError(`[SyncQueue] Max retries reached for ${id}`);
        this.remove(id);
        return false;
      }

      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      return true;
    } catch (error) {
      debugLogger.logError('[SyncQueue] Failed to increment retry', error);
      return false;
    }
  }

  /**
   * Clear entire queue
   */
  static clear(): void {
    try {
      localStorage.removeItem(SYNC_QUEUE_KEY);
      debugLogger.logInfo('[SyncQueue] Cleared queue');
    } catch (error) {
      debugLogger.logError('[SyncQueue] Failed to clear queue', error);
    }
  }

  /**
   * Get queue size
   */
  static size(): number {
    return this.getQueue().length;
  }
}

/**
 * Auto-cleanup on app load
 */
if (typeof window !== 'undefined') {
  // Clear expired cache entries on page load
  CacheService.clearExpired();

  // Log cache stats in dev mode
  const stats = CacheService.getStats();
  debugLogger.logInfo('[Cache] Initialized', {
    entries: stats.totalEntries,
    size: `${(stats.totalSize / 1024).toFixed(2)} KB`,
    queueSize: SyncQueue.size(),
  });
}
