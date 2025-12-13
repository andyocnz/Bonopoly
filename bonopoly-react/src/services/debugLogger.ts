/**
 * Debug Logger Service
 *
 * Logs ALL API requests/responses in dev mode
 * Shows detailed errors with stack traces
 * Prints everything to console AND stores in memory for debug panel
 */

export interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'api-request' | 'api-response' | 'api-error' | 'calculation' | 'error' | 'info';
  message: string;
  data?: any;
  stack?: string;
}

class DebugLogger {
  private logs: DebugLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private isDev = import.meta.env.DEV;

  /**
   * Log API request (shows full URL and parameters)
   */
  logApiRequest(url: string, params?: any) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'api-request',
      message: `API Request: ${url}`,
      data: params,
    };

    this.addLog(log);

    if (this.isDev) {
      console.group('🌐 API Request');
      console.log('URL:', url);
      if (params) {
        console.log('Params:', params);
      }
      console.groupEnd();
    }
  }

  /**
   * Log API response (shows full response JSON)
   */
  logApiResponse(url: string, response: any, duration?: number) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'api-response',
      message: `API Response: ${url}${duration ? ` (${duration}ms)` : ''}`,
      data: response,
    };

    this.addLog(log);

    if (this.isDev) {
      console.group(`✅ API Response${duration ? ` (${duration}ms)` : ''}`);
      console.log('URL:', url);
      console.log('Response:', response);
      console.groupEnd();
    }
  }

  /**
   * Log API error (shows error message and stack trace)
   */
  logApiError(url: string, error: any) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'api-error',
      message: `API Error: ${url}`,
      data: {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      },
      stack: error.stack,
    };

    this.addLog(log);

    if (this.isDev) {
      console.group('❌ API Error');
      console.error('URL:', url);
      console.error('Error:', error);
      if (error.response) {
        console.error('Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
      console.groupEnd();
    }
  }

  /**
   * Log calculation step (for debugging formulas)
   */
  logCalculation(step: string, input: any, output: any, formula?: string) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'calculation',
      message: step,
      data: {
        input,
        output,
        formula,
      },
    };

    this.addLog(log);

    if (this.isDev) {
      console.group(`🧮 Calculation: ${step}`);
      console.log('Input:', input);
      if (formula) {
        console.log('Formula:', formula);
      }
      console.log('Output:', output);
      console.groupEnd();
    }
  }

  /**
   * Log general error
   */
  logError(message: string, error?: any) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'error',
      message,
      data: error,
      stack: error?.stack,
    };

    this.addLog(log);

    if (this.isDev) {
      console.error(`❌ ${message}`, error);
    }
  }

  /**
   * Log general info
   */
  logInfo(message: string, data?: any) {
    const log: DebugLog = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'info',
      message,
      data,
    };

    this.addLog(log);

    if (this.isDev) {
      console.log(`ℹ️ ${message}`, data || '');
    }
  }

  /**
   * Get all logs
   */
  getLogs(): DebugLog[] {
    return [...this.logs];
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: DebugLog['type']): DebugLog[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    if (this.isDev) {
      console.clear();
      console.log('🗑️ Debug logs cleared');
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Download logs as file
   */
  downloadLogs() {
    const json = this.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bonopoly-debug-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Private methods

  private addLog(log: DebugLog) {
    this.logs.push(log);

    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const debugLogger = new DebugLogger();

// Also export for direct import
export default debugLogger;
