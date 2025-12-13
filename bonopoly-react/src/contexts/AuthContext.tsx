/**
 * Authentication Context
 *
 * SIMPLE AUTH:
 * - Educator: game_code + game_pin
 * - Team: game_code + team_pin
 *
 * No passwords, no email verification
 * Session stored in localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getGame, readSheet } from '@/services/googleSheetsApi';
import { SHEET_NAMES } from '@/config/googleSheets';
import { debugLogger } from '@/services/debugLogger';
import { useNotification } from './NotificationContext';

export type UserRole = 'educator' | 'team';

export interface GameData {
  id: number;
  game_code: string;
  game_pin: string;
  name: string;
  educator_email: string;
  num_teams: number;
  num_rounds: number;
  hours_per_round: number;
  start_time: string;
  timezone: string;
  current_round: number;
  template: string;
  status: string;
}

export interface TeamData {
  game_id: number;
  team_id: number;
  team_name: string;
  team_pin: string;
  email?: string;
}

export interface AuthState {
  role: UserRole | null;
  game: GameData | null;
  team: TeamData | null; // Only for team role
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  loginEducator: (gameCode: string, gamePin: string) => Promise<boolean>;
  loginTeam: (gameCode: string, teamPin: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'bonopoly_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    role: null,
    game: null,
    team: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const { showSuccess, showError, showInfo } = useNotification();

  // Load auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        debugLogger.logInfo('Restored auth session from localStorage', parsed);
        setAuthState({
          ...parsed,
          isLoading: false,
        });
      } catch (error) {
        debugLogger.logError('Failed to parse stored auth', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Save auth to localStorage whenever it changes
  useEffect(() => {
    if (!authState.isLoading) {
      if (authState.isAuthenticated) {
        const toStore = {
          role: authState.role,
          game: authState.game,
          team: authState.team,
          isAuthenticated: authState.isAuthenticated,
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore));
        debugLogger.logInfo('Saved auth session to localStorage', toStore);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, [authState]);

  const loginEducator = useCallback(async (gameCode: string, gamePin: string): Promise<boolean> => {
    debugLogger.logInfo('Educator login attempt', { gameCode, gamePin });

    try {
      // Fetch game by game_code
      const response = await getGame(gameCode);

      if (!response.success) {
        showError('Failed to connect to database', response.error);
        return false;
      }

      if (!response.data || response.data.length === 0) {
        showError('Invalid game code');
        return false;
      }

      const game = response.data[0] as any; // Use 'any' to handle different field names

      // Google Sheets returns game_pin as NUMBER, convert to string for comparison
      const actualGamePin = String(game.game_pin || game.gamePin || '');

      debugLogger.logInfo('Game object received', game);
      debugLogger.logInfo('PIN comparison', {
        actualGamePin,
        inputGamePin: gamePin,
        actualType: typeof actualGamePin,
        inputType: typeof gamePin,
        match: actualGamePin === gamePin
      });

      // Check game PIN (compare as strings)
      if (actualGamePin !== gamePin) {
        showError(`Invalid game PIN`);
        return false;
      }

      // Normalize the game object to snake_case for consistency
      const normalizedGame: GameData = {
        id: game.id,
        game_code: String(game.game_code || game.gameCode || ''),
        game_pin: actualGamePin, // Already converted to string above
        name: game.name,
        educator_email: game.educator_email || game.educatorEmail,
        num_teams: Number(game.num_teams || game.numTeams || 0),
        num_rounds: Number(game.num_rounds || game.numRounds || 0),
        hours_per_round: Number(game.hours_per_round || game.hoursPerRound || 0),
        start_time: game.start_time || game.startTime,
        timezone: game.timezone,
        current_round: Number(game.current_round || game.currentRound || 1),
        template: game.template,
        status: game.status,
      };

      // Success!
      debugLogger.logInfo('Educator login successful', { game: normalizedGame });

      setAuthState({
        role: 'educator',
        game: normalizedGame,
        team: null,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome back, ${normalizedGame.educator_email}!`);
      return true;

    } catch (error) {
      debugLogger.logError('Educator login error', error);
      showError('Login failed', error);
      return false;
    }
  }, [showSuccess, showError]);

  const loginTeam = useCallback(async (gameCode: string, teamPin: string): Promise<boolean> => {
    debugLogger.logInfo('Team login attempt', { gameCode, teamPin });

    try {
      // First, fetch game by game_code
      const gameResponse = await getGame(gameCode);

      if (!gameResponse.success || !gameResponse.data || gameResponse.data.length === 0) {
        showError('Invalid game code');
        return false;
      }

      const gameData = gameResponse.data[0] as any; // Use 'any' to handle different field names

      // Normalize game object to snake_case for consistency
      const normalizedGame: GameData = {
        id: gameData.id,
        game_code: gameData.game_code || gameData.gameCode,
        game_pin: gameData.game_pin || gameData.gamePin,
        name: gameData.name,
        educator_email: gameData.educator_email || gameData.educatorEmail,
        num_teams: gameData.num_teams || gameData.numTeams,
        num_rounds: gameData.num_rounds || gameData.numRounds,
        hours_per_round: gameData.hours_per_round || gameData.hoursPerRound,
        start_time: gameData.start_time || gameData.startTime,
        timezone: gameData.timezone,
        current_round: gameData.current_round || gameData.currentRound,
        template: gameData.template,
        status: gameData.status,
      };

      // Then, fetch team by game_id and team_pin
      const teamResponse = await readSheet(SHEET_NAMES.TEAMS, {
        game_id: normalizedGame.id,
        team_pin: teamPin,
      });

      if (!teamResponse.success) {
        showError('Failed to connect to database', teamResponse.error);
        return false;
      }

      if (!teamResponse.data || teamResponse.data.length === 0) {
        showError('Invalid team PIN for this game');
        return false;
      }

      const teamData = teamResponse.data[0] as any; // Use 'any' to handle different field names

      // Normalize team object to snake_case for consistency
      const normalizedTeam: TeamData = {
        game_id: teamData.game_id || teamData.gameId,
        team_id: teamData.team_id || teamData.teamId,
        team_name: teamData.team_name || teamData.teamName,
        team_pin: teamData.team_pin || teamData.teamPin,
        email: teamData.email,
      };

      // Success!
      debugLogger.logInfo('Team login successful', { game: normalizedGame, team: normalizedTeam });

      setAuthState({
        role: 'team',
        game: normalizedGame,
        team: normalizedTeam,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome, ${normalizedTeam.team_name}!`);
      return true;

    } catch (error) {
      debugLogger.logError('Team login error', error);
      showError('Login failed', error);
      return false;
    }
  }, [showSuccess, showError]);

  const logout = useCallback(() => {
    debugLogger.logInfo('User logged out');

    setAuthState({
      role: null,
      game: null,
      team: null,
      isAuthenticated: false,
      isLoading: false,
    });

    showInfo('Logged out successfully');
  }, [showInfo]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        loginEducator,
        loginTeam,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
