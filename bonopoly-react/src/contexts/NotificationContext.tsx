/**
 * Notification Context
 *
 * Provides toast notifications throughout the app
 * - Success notifications
 * - Error notifications (with debug details in dev mode)
 * - Info/Warning notifications
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertTitle, Box, Typography } from '@mui/material';
import { debugLogger } from '@/services/debugLogger';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string; // Stack trace or additional details (dev mode only)
  duration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, details?: any) => void;
  showSuccess: (message: string) => void;
  showError: (message: string, error?: any) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const isDev = import.meta.env.DEV;

  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    details?: any
  ) => {
    const id = `${Date.now()}-${Math.random()}`;

    // Format details for dev mode
    let formattedDetails: string | undefined;
    if (isDev && details) {
      if (typeof details === 'string') {
        formattedDetails = details;
      } else if (details instanceof Error) {
        formattedDetails = `${details.message}\n${details.stack || ''}`;
      } else {
        formattedDetails = JSON.stringify(details, null, 2);
      }
    }

    setNotification({
      id,
      type,
      message,
      details: formattedDetails,
      duration: type === 'error' ? 8000 : 5000, // Errors stay longer
    });

    // Log to debug logger
    if (type === 'error') {
      debugLogger.logError(message, details);
    } else {
      debugLogger.logInfo(`[${type.toUpperCase()}] ${message}`, details);
    }
  }, [isDev]);

  const showSuccess = useCallback((message: string) => {
    showNotification('success', message);
  }, [showNotification]);

  const showError = useCallback((message: string, error?: any) => {
    showNotification('error', message, error);
  }, [showNotification]);

  const showInfo = useCallback((message: string) => {
    showNotification('info', message);
  }, [showNotification]);

  const showWarning = useCallback((message: string) => {
    showNotification('warning', message);
  }, [showNotification]);

  const handleClose = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}

      {notification && (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleClose}
            severity={notification.type}
            sx={{ minWidth: '300px', maxWidth: '500px' }}
          >
            <AlertTitle sx={{ fontWeight: 600 }}>
              {notification.type === 'success' && '✅ Success'}
              {notification.type === 'error' && '❌ Error'}
              {notification.type === 'info' && 'ℹ️ Info'}
              {notification.type === 'warning' && '⚠️ Warning'}
            </AlertTitle>
            <Typography variant="body2">{notification.message}</Typography>

            {/* Show debug details in dev mode */}
            {isDev && notification.details && (
              <Box
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  borderRadius: 1,
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {notification.details}
              </Box>
            )}
          </Alert>
        </Snackbar>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
