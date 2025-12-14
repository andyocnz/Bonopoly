/**
 * useBackgroundSync Hook
 *
 * Automatically processes sync queue in the background
 * Shows sync status to user
 */

import { useState, useEffect, useCallback } from 'react';
import { processSyncQueue, getSyncStatus } from '@/services/cachedGoogleSheetsApi';
import { debugLogger } from '@/services/debugLogger';

const SYNC_INTERVAL = 10 * 1000; // Sync every 10 seconds
const STATUS_UPDATE_INTERVAL = 2 * 1000; // Update status every 2 seconds

export interface SyncStatus {
  isSyncing: boolean;
  queueSize: number;
  lastSyncTime: number | null;
  lastSyncResult: {
    processed: number;
    failed: number;
  } | null;
}

export function useBackgroundSync(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    queueSize: 0,
    lastSyncTime: null,
    lastSyncResult: null,
  });

  // Update queue size
  const updateStatus = useCallback(() => {
    const { queueSize } = getSyncStatus();
    setStatus((prev) => ({
      ...prev,
      queueSize,
    }));
  }, []);

  // Process sync queue
  const sync = useCallback(async () => {
    if (!enabled) return;

    const { queueSize } = getSyncStatus();
    if (queueSize === 0) return;

    setStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await processSyncQueue();
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        queueSize: result.pending,
        lastSyncTime: Date.now(),
        lastSyncResult: {
          processed: result.processed,
          failed: result.failed,
        },
      }));

      if (result.processed > 0) {
        debugLogger.logInfo(`[Sync] Synced ${result.processed} items`);
      }
    } catch (error) {
      debugLogger.logError('[Sync] Failed to process queue', error);
      setStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [enabled]);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    sync();
  }, [sync]);

  // Auto-sync on interval
  useEffect(() => {
    if (!enabled) return;

    // Initial status update
    updateStatus();

    // Update status periodically
    const statusInterval = setInterval(updateStatus, STATUS_UPDATE_INTERVAL);

    // Sync periodically
    const syncInterval = setInterval(sync, SYNC_INTERVAL);

    // Sync on page visibility change (when user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateStatus();
        sync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Sync on network reconnect
    const handleOnline = () => {
      debugLogger.logInfo('[Sync] Network reconnected, syncing...');
      sync();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(statusInterval);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, sync, updateStatus]);

  return {
    status,
    triggerSync,
  };
}
