/**
 * Sync Status Indicator Component
 *
 * Shows real-time sync status in the UI:
 * - Synced ✓ (green)
 * - Syncing... (blue spinner)
 * - Failed ⚠️ (yellow)
 * - Offline 📡 (gray)
 */

import React from 'react';
import { Box, Chip, Tooltip, CircularProgress, IconButton } from '@mui/material';
import {
  CloudDone,
  CloudSync,
  CloudOff,
  Warning,
  Refresh,
} from '@mui/icons-material';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';

export function SyncStatusIndicator() {
  const { status, triggerSync } = useBackgroundSync();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Determine status
  let icon: React.ReactNode;
  let label: string;
  let color: 'success' | 'info' | 'warning' | 'default' | 'error';
  let tooltipText: string;

  if (!isOnline) {
    icon = <CloudOff />;
    label = 'Offline';
    color = 'default';
    tooltipText = 'No internet connection. Changes will sync when online.';
  } else if (status.isSyncing) {
    icon = <CircularProgress size={16} sx={{ color: 'white' }} />;
    label = 'Syncing...';
    color = 'info';
    tooltipText = `Syncing ${status.queueSize} item(s) to Google Sheets...`;
  } else if (status.queueSize > 0) {
    icon = <CloudSync />;
    label = `${status.queueSize} pending`;
    color = 'warning';
    tooltipText = `${status.queueSize} change(s) waiting to sync`;
  } else if (status.lastSyncResult && status.lastSyncResult.failed > 0) {
    icon = <Warning />;
    label = 'Sync failed';
    color = 'error';
    tooltipText = `${status.lastSyncResult.failed} item(s) failed to sync. Will retry.`;
  } else {
    icon = <CloudDone />;
    label = 'Synced';
    color = 'success';
    tooltipText = status.lastSyncTime
      ? `Last synced ${getTimeAgo(status.lastSyncTime)}`
      : 'All changes synced';
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={tooltipText}>
        <Chip
          icon={icon}
          label={label}
          color={color}
          size="small"
          sx={{
            fontWeight: 600,
            '& .MuiChip-icon': {
              marginLeft: 1,
            },
          }}
        />
      </Tooltip>

      {(status.queueSize > 0 || status.lastSyncResult?.failed) && (
        <Tooltip title="Sync now">
          <IconButton
            size="small"
            onClick={triggerSync}
            disabled={status.isSyncing}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
