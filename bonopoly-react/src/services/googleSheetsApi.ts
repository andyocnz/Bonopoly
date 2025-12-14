/**
 * Google Sheets API Service
 * Simple wrapper for Apps Script database operations
 * WITH FULL DEBUG LOGGING
 */

import { GOOGLE_SHEETS_CONFIG, SHEET_NAMES } from '@/config/googleSheets';
import { debugLogger } from './debugLogger';

type SheetName = typeof SHEET_NAMES[keyof typeof SHEET_NAMES];

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Build API URL with parameters
 */
function buildUrl(action: string, params: Record<string, any> = {}): string {
  const url = new URL(GOOGLE_SHEETS_CONFIG.apiUrl);
  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });

  return url.toString();
}

/**
 * Make request to Apps Script
 * WITH FULL DEBUG LOGGING
 */
async function makeRequest<T = any>(url: string): Promise<ApiResponse<T>> {
  const startTime = Date.now();

  // Log request
  debugLogger.logApiRequest(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_SHEETS_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log successful response
    const duration = Date.now() - startTime;
    debugLogger.logApiResponse(url, data, duration);

    return data;

  } catch (error) {
    clearTimeout(timeoutId);

    // Log error
    debugLogger.logApiError(url, error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' };
      }
      return { success: false, error: error.message };
    }

    return { success: false, error: 'Unknown error' };
  }
}

/**
 * Test connection to Apps Script
 */
export async function testConnection(): Promise<ApiResponse> {
  const url = buildUrl('test');
  return makeRequest(url);
}

/**
 * Read from sheet
 * @param sheet - Sheet name
 * @param filters - Optional filters { column: value }
 */
export async function readSheet<T = any>(
  sheet: SheetName,
  filters?: Record<string, any>
): Promise<ApiResponse<T[]>> {
  const url = buildUrl('read', { sheet, filters });
  return makeRequest<T[]>(url);
}

/**
 * Write to sheet (append new row)
 * @param sheet - Sheet name
 * @param data - Row data as object
 */
export async function writeSheet(
  sheet: SheetName,
  data: Record<string, any>
): Promise<ApiResponse> {
  const url = buildUrl('write', { sheet, data });
  return makeRequest(url);
}

/**
 * Update existing row in sheet
 * @param sheet - Sheet name
 * @param filters - Find row by these filters
 * @param data - Update with this data
 */
export async function updateSheet(
  sheet: SheetName,
  filters: Record<string, any>,
  data: Record<string, any>
): Promise<ApiResponse> {
  const url = buildUrl('update', { sheet, filters, data });
  return makeRequest(url);
}

// ============================================
// TYPED HELPERS (Game-specific)
// ============================================

/**
 * Get game by game code
 * NOTE: Google Sheets column is 'game_code' (snake_case)
 */
export async function getGame(gameCode: string) {
  return readSheet(SHEET_NAMES.GAME, { game_code: gameCode });
}

/**
 * Get teams for a game
 */
export async function getTeams(gameCode: string) {
  return readSheet(SHEET_NAMES.TEAMS, { game_code: gameCode });
}

/**
 * Get decisions for a team/round
 */
export async function getDecisions(gameCode: string, teamId: number, round: number) {
  return readSheet(SHEET_NAMES.DECISIONS, { game_code: gameCode, team_id: teamId, round });
}

/**
 * Save decision
 */
export async function saveDecision(
  gameCode: string,
  teamId: number,
  round: number,
  decisionData: any
) {
  return writeSheet(SHEET_NAMES.DECISIONS, {
    game_code: gameCode,
    team_id: teamId,
    round,
    timestamp: new Date().toISOString(),
    status: 'submitted',
    decision_json: JSON.stringify(decisionData),
  });
}

/**
 * Get outputs for a team/round
 */
export async function getOutputs(gameCode: string, teamId: number, round: number) {
  return readSheet(SHEET_NAMES.OUTPUTS, { game_code: gameCode, team_id: teamId, round });
}

/**
 * Save output (results)
 */
export async function saveOutput(
  gameCode: string,
  teamId: number,
  round: number,
  outputData: any
) {
  return writeSheet(SHEET_NAMES.OUTPUTS, {
    game_code: gameCode,
    team_id: teamId,
    round,
    visible: true, // Always true, frontend checks deadline
    output_json: JSON.stringify(outputData),
  });
}

/**
 * Get round scenario
 */
export async function getRoundScenario(gameCode: string, round: number) {
  return readSheet(SHEET_NAMES.ROUND_SCENARIOS, { game_code: gameCode, round });
}

// ============================================
// DUPLICATE PREVENTION & CODE GENERATION
// ============================================

/**
 * Generate unique game code (6 characters)
 * Avoids ambiguous characters: 0, O, I, 1
 */
function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate unique team or game PIN (7 digits)
 */
function generatePin(): string {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

/**
 * Check if game code already exists
 * CRITICAL: Prevents duplicate game codes
 */
export async function checkGameCodeExists(gameCode: string): Promise<boolean> {
  debugLogger.logInfo('Checking for duplicate game code', { gameCode });

  const response = await getGame(gameCode);

  const exists = response.success && response.data && response.data.length > 0;

  debugLogger.logInfo('Game code check result', { gameCode, exists });

  return exists;
}

/**
 * Check if team PIN already exists for a game
 * CRITICAL: Prevents duplicate team PINs within same game
 */
export async function checkTeamPinExists(gameCode: string, teamPin: string): Promise<boolean> {
  debugLogger.logInfo('Checking for duplicate team PIN', { gameCode, teamPin });

  const response = await readSheet(SHEET_NAMES.TEAMS, { game_code: gameCode, team_pin: teamPin });

  const exists = response.success && response.data && response.data.length > 0;

  debugLogger.logInfo('Team PIN check result', { gameCode, teamPin, exists });

  return exists;
}

/**
 * Generate unique game code (retries until unique)
 * CRITICAL: Ensures no duplicate game codes
 */
export async function generateUniqueGameCode(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateGameCode();
    const exists = await checkGameCodeExists(code);

    if (!exists) {
      debugLogger.logInfo('Generated unique game code', { code, attempts });
      return code;
    }

    attempts++;
    debugLogger.logInfo('Game code collision, retrying', { code, attempts });
  }

  throw new Error('Failed to generate unique game code after 10 attempts');
}

/**
 * Generate unique team PIN for a game (retries until unique)
 * CRITICAL: Ensures no duplicate team PINs within same game
 */
export async function generateUniqueTeamPin(gameCode: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const pin = generatePin();
    const exists = await checkTeamPinExists(gameCode, pin);

    if (!exists) {
      debugLogger.logInfo('Generated unique team PIN', { gameCode, pin, attempts });
      return pin;
    }

    attempts++;
    debugLogger.logInfo('Team PIN collision, retrying', { gameCode, pin, attempts });
  }

  throw new Error(`Failed to generate unique team PIN for game ${gameCode} after 10 attempts`);
}

/**
 * Generate game PIN (doesn't need to be unique, just for educator auth)
 */
export function generateGamePin(): string {
  return generatePin();
}
