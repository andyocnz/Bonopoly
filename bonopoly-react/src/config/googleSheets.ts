/**
 * Google Sheets Configuration
 * Apps Script Web App URL for database operations
 */

export const GOOGLE_SHEETS_CONFIG = {
  /**
   * Apps Script Web App URL
   * Update this when deploying new version of Apps Script
   */
  apiUrl: 'https://script.google.com/macros/s/AKfycbw_qGZbwl9pHyT7_oASmYBWOBpI0yu4OpCajHaV8j-9qw76CJKcAoPhWR5mb33545IP/exec',

  /**
   * Request timeout (ms)
   */
  timeout: 10000,

  /**
   * Retry configuration
   */
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
  },
} as const;

/**
 * Sheet names (must match Google Sheets exactly)
 */
export const SHEET_NAMES = {
  GAME: 'Game',
  TEAMS: 'Teams',
  DECISIONS: 'Decisions',
  OUTPUTS: 'Outputs',
  ROUND_SCENARIOS: 'Round_Scenarios',
} as const;
