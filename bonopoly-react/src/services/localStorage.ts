import { Decision } from '../types';

const STORAGE_KEY = 'bonopoly_game_data';
const VERSION = '1.0';

export interface LocalStorageData {
  version: string;
  gameId: string;
  teamId: string;
  activeRound: number;
  decisions: Partial<Decision>;
  submitted: boolean;
  lastSaved: string;
}

/**
 * Save draft decisions to localStorage
 */
export const saveDecisions = (data: LocalStorageData): void => {
  try {
    const jsonData = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, jsonData);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    throw new Error('Failed to save decisions');
  }
};

/**
 * Load decisions from localStorage
 */
export const loadDecisions = (): LocalStorageData | null => {
  try {
    const jsonData = localStorage.getItem(STORAGE_KEY);
    if (!jsonData) return null;

    const data: LocalStorageData = JSON.parse(jsonData);

    // Version check
    if (data.version !== VERSION) {
      console.warn('localStorage version mismatch, clearing old data');
      clearDecisions();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

/**
 * Clear all localStorage data
 */
export const clearDecisions = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Initialize new game session in localStorage
 */
export const initializeSession = (
  gameId: string,
  teamId: string,
  round: number
): LocalStorageData => {
  const data: LocalStorageData = {
    version: VERSION,
    gameId,
    teamId,
    activeRound: round,
    decisions: {
      round,
      teamId,
      timestamp: new Date().toISOString(),
      submitted: false,
    },
    submitted: false,
    lastSaved: new Date().toISOString(),
  };

  saveDecisions(data);
  return data;
};

/**
 * Update specific decision area
 */
export const updateDecisionArea = <K extends keyof Decision>(
  area: K,
  value: Decision[K]
): void => {
  const data = loadDecisions();
  if (!data) {
    throw new Error('No active session');
  }

  data.decisions[area] = value;
  data.lastSaved = new Date().toISOString();

  saveDecisions(data);
};

/**
 * Mark decisions as submitted
 */
export const markAsSubmitted = (): void => {
  const data = loadDecisions();
  if (!data) {
    throw new Error('No active session');
  }

  data.submitted = true;
  data.decisions.submitted = true;
  data.decisions.timestamp = new Date().toISOString();
  data.lastSaved = new Date().toISOString();

  saveDecisions(data);
};

/**
 * Get complete decision object for submission
 */
export const getDecisionsForSubmit = (): Decision | null => {
  const data = loadDecisions();
  if (!data || !data.decisions) return null;

  // Validate all required fields are present
  const required: (keyof Decision)[] = [
    'round',
    'teamId',
    'production',
    'hr',
    'rnd',
    'investment',
    'logistics',
    'marketing',
    'finance',
  ];

  for (const field of required) {
    if (!data.decisions[field]) {
      throw new Error(`Missing required decision field: ${field}`);
    }
  }

  return data.decisions as Decision;
};

/**
 * Check if localStorage has enough space (estimate)
 */
export const checkStorageSpace = (): { used: number; available: number; percentage: number } => {
  const data = loadDecisions();
  const dataSize = data ? JSON.stringify(data).length : 0;
  const maxSize = 5 * 1024 * 1024; // 5MB typical localStorage limit

  return {
    used: dataSize,
    available: maxSize - dataSize,
    percentage: (dataSize / maxSize) * 100,
  };
};
