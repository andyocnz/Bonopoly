/**
 * Cached Google Sheets API Service
 *
 * Wrapper around googleSheetsApi.ts that adds intelligent caching:
 * - READ: Cache-first with TTL
 * - WRITE: Optimistic updates + background sync
 * - Automatic cache invalidation
 */

import {
  readSheet as uncachedReadSheet,
  writeSheet as uncachedWriteSheet,
  updateSheet as uncachedUpdateSheet,
} from './googleSheetsApi';
import { CacheService, SyncQueue, CACHE_TTL } from './cacheService';
import { SHEET_NAMES } from '@/config/googleSheets';
import { debugLogger } from './debugLogger';

type SheetName = typeof SHEET_NAMES[keyof typeof SHEET_NAMES];

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  cached?: boolean; // Indicates if data came from cache
}

/**
 * Determine appropriate TTL for a sheet/filters combination
 */
function getTTL(sheet: SheetName, filters?: Record<string, any>): number {
  // Game settings
  if (sheet === SHEET_NAMES.GAME) {
    return CACHE_TTL.GAME;
  }

  // Teams list
  if (sheet === SHEET_NAMES.TEAMS) {
    return CACHE_TTL.TEAMS;
  }

  // Scenarios (never change)
  if (sheet === SHEET_NAMES.ROUND_SCENARIOS) {
    return CACHE_TTL.SCENARIOS;
  }

  // Decisions - check if current or historical
  if (sheet === SHEET_NAMES.DECISIONS) {
    // If filtering by specific round that's in the past, cache longer
    // For now, use short TTL for current round monitoring
    return CACHE_TTL.DECISIONS_CURRENT;
  }

  // Outputs - similar logic
  if (sheet === SHEET_NAMES.OUTPUTS) {
    return CACHE_TTL.OUTPUTS_CURRENT;
  }

  return CACHE_TTL.DEFAULT;
}

/**
 * Read from sheet with caching
 * Strategy: Cache-first, background refresh if stale
 */
export async function readSheet<T = any>(
  sheet: SheetName,
  filters?: Record<string, any>,
  options: { forceRefresh?: boolean; skipCache?: boolean } = {}
): Promise<ApiResponse<T[]>> {
  const { forceRefresh = false, skipCache = false } = options;

  // Check cache first (unless force refresh or skip cache)
  if (!forceRefresh && !skipCache) {
    const cached = CacheService.get<T[]>(sheet, filters);
    if (cached !== null) {
      debugLogger.logInfo('[CachedAPI] Returning cached data', { sheet, filters });
      return {
        success: true,
        data: cached,
        cached: true,
      };
    }
  }

  // Cache miss or force refresh - fetch from Google Sheets
  debugLogger.logInfo('[CachedAPI] Fetching from Google Sheets', { sheet, filters });

  try {
    const response = await uncachedReadSheet<T>(sheet, filters);

    // Cache successful responses
    if (response.success && response.data) {
      const ttl = getTTL(sheet, filters);
      CacheService.set(sheet, response.data, filters, ttl);
    }

    return {
      ...response,
      cached: false,
    };
  } catch (error: any) {
    debugLogger.logError('[CachedAPI] Read failed', error);

    // If network error, try to return stale cache as fallback
    const staleCache = CacheService.get<T[]>(sheet, filters);
    if (staleCache !== null) {
      debugLogger.logInfo('[CachedAPI] Returning stale cache due to error');
      return {
        success: true,
        data: staleCache,
        cached: true,
        message: 'Using cached data (network error)',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to read data',
    };
  }
}

/**
 * Write to sheet with optimistic update
 * Strategy: Update cache immediately, queue sync to Google Sheets
 */
export async function writeSheet(
  sheet: SheetName,
  data: Record<string, any>,
  options: { optimistic?: boolean; syncImmediately?: boolean } = {}
): Promise<ApiResponse> {
  const { optimistic = true, syncImmediately = false } = options;

  if (optimistic) {
    // Optimistic update: Invalidate cache immediately
    // This ensures next read will fetch fresh data
    CacheService.invalidateSheet(sheet);
    debugLogger.logInfo('[CachedAPI] Optimistic invalidation', { sheet });
  }

  if (syncImmediately) {
    // Immediate sync to Google Sheets
    try {
      const response = await uncachedWriteSheet(sheet, data);

      if (response.success) {
        // Invalidate cache to ensure consistency
        CacheService.invalidateSheet(sheet);
      }

      return response;
    } catch (error: any) {
      debugLogger.logError('[CachedAPI] Write failed', error);
      return {
        success: false,
        error: error.message || 'Failed to write data',
      };
    }
  } else {
    // Background sync: Queue the write
    SyncQueue.add({
      action: 'write',
      sheet,
      data,
    });

    debugLogger.logInfo('[CachedAPI] Queued write for background sync', { sheet });

    return {
      success: true,
      message: 'Write queued for sync',
    };
  }
}

/**
 * Update sheet with optimistic update
 */
export async function updateSheet(
  sheet: SheetName,
  filters: Record<string, any>,
  data: Record<string, any>,
  options: { optimistic?: boolean; syncImmediately?: boolean } = {}
): Promise<ApiResponse> {
  const { optimistic = true, syncImmediately = false } = options;

  if (optimistic) {
    // Invalidate cache for this sheet
    CacheService.invalidateSheet(sheet);
    debugLogger.logInfo('[CachedAPI] Optimistic invalidation', { sheet, filters });
  }

  if (syncImmediately) {
    // Immediate sync
    try {
      const response = await uncachedUpdateSheet(sheet, filters, data);

      if (response.success) {
        CacheService.invalidateSheet(sheet);
      }

      return response;
    } catch (error: any) {
      debugLogger.logError('[CachedAPI] Update failed', error);
      return {
        success: false,
        error: error.message || 'Failed to update data',
      };
    }
  } else {
    // Background sync
    SyncQueue.add({
      action: 'update',
      sheet,
      filters,
      data,
    });

    debugLogger.logInfo('[CachedAPI] Queued update for background sync', { sheet, filters });

    return {
      success: true,
      message: 'Update queued for sync',
    };
  }
}

/**
 * Process sync queue
 * Call this periodically or on network reconnect
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  pending: number;
}> {
  const queue = SyncQueue.getQueue();
  let processed = 0;
  let failed = 0;

  debugLogger.logInfo(`[SyncQueue] Processing ${queue.length} items`);

  for (const item of queue) {
    try {
      let response;

      if (item.action === 'write') {
        response = await uncachedWriteSheet(item.sheet, item.data);
      } else if (item.action === 'update') {
        response = await uncachedUpdateSheet(item.sheet, item.filters, item.data);
      }

      if (response && response.success) {
        SyncQueue.remove(item.id);
        CacheService.invalidateSheet(item.sheet);
        processed++;
        debugLogger.logInfo(`[SyncQueue] Synced item: ${item.id}`);
      } else {
        // Failed - increment retry
        const shouldRetry = SyncQueue.incrementRetry(item.id);
        if (!shouldRetry) {
          failed++;
        }
      }
    } catch (error) {
      debugLogger.logError(`[SyncQueue] Failed to sync item: ${item.id}`, error);
      const shouldRetry = SyncQueue.incrementRetry(item.id);
      if (!shouldRetry) {
        failed++;
      }
    }
  }

  const pending = SyncQueue.size();

  debugLogger.logInfo('[SyncQueue] Processing complete', { processed, failed, pending });

  return { processed, failed, pending };
}

/**
 * Force refresh all caches
 * Useful for "hard refresh" button
 */
export function clearAllCaches(): void {
  CacheService.clearAll();
  debugLogger.logInfo('[CachedAPI] All caches cleared');
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  queueSize: number;
  cacheStats: ReturnType<typeof CacheService.getStats>;
} {
  return {
    queueSize: SyncQueue.size(),
    cacheStats: CacheService.getStats(),
  };
}
