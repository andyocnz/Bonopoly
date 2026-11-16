const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')
import type { GameConfig } from '../engine/gameEngine'

type GameConfigSnapshot = GameConfig
type GameConfigOverrides = Record<string, unknown>
type CachedGetEntry = { etag: string; data: unknown }
type EducatorApiUser = { id: string; email: string; credits: number; pin?: string }
type EducatorApiTransaction = {
  id: string
  createdAt: string
  type: string
  amount: number
  balanceAfter: number
  adminUser?: string | null
}
type EducatorOwnedGame = {
  id: string
  gameCode: string
  gamePin: string
  name: string
  status: string
  companyName?: string
  industry?: string
  totalRounds: number
  currentRound: number
  createdAt: string
  roundDeadline?: string | null
  teams: Array<{
    id: string
    name: string
    teamCode: string
    teamPin: string
    color: string
    isComputer: boolean
  }>
}
type EducatorGameResult = {
  gameId: string
  teamId: string
  roundNumber: number
  rank: number
  fullResults: unknown
  createdAt: string
  team?: { id: string; name: string }
}
type TournamentSummary = {
  id: string
  name: string
  status: string
  createdAt: string
  totalRounds?: number
  currentRound?: number
}
type PublicInvoiceTransaction = {
  id: string
  amount: number
  educatorEmail: string
  createdAt: string
}

export type MiniGameTypeSlug =
  | 'bank-run'
  | 'fishery'
  | 'double-auction'
  | 'credit-score'
  | 'prisoners-dilemma'
  | 'matching-pennies'
  | 'ultimatum'
  | 'trust-game'
  | 'public-goods'
  | 'cournot'
  | 'bertrand'
  | 'english-auction'
  | 'beauty-contest'
  | 'monte-carlo-pi'
  | 'market-survival'
  | 'portfolio-frontier'
  | 'adverse-selection'
  | 'signaling-game'
  | 'principal-agent'
  | 'monopoly-pricing'
  | 'asset-bubble'
  | 'market-basket'
  | 'ab-testing'
  | 'customer-churn'
  | 'conflict-of-interest'
  | 'ad-auction'
  | 'director-duties'
  | 'social-influence'
  | 'crypto-bubble'
  | 'capital-structure-lab'
  | 'xero-reconciliation'
  | 'game-of-life'

export type EducatorMiniGameSession = {
  id: string
  gameType: MiniGameTypeSlug
  title: string | null
  status: 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  teamCount: number
  joinedCount?: number
  roomCode: string | null
  hostToken: string | null
  createdAt: string
  joinByCodeLink?: string
  hostLink: string
  invites: Array<{
    id: string
    teamLabel: string
    usedCount: number
    playLink: string
  }>
}

export type EducatorMiniGamePlayer = {
  id: string
  name: string
  isBot: boolean
  submitted?: boolean
}

const cachedGetResponses = new Map<string, CachedGetEntry>()

function buildGetCacheKey(endpoint: string): string {
  return `GET ${endpoint}`
}

function parseJsonSafely(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

async function requestGetWithEtag<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cacheKey = buildGetCacheKey(endpoint)
  const cached = cachedGetResponses.get(cacheKey)
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (cached?.etag) {
    headers.set('If-None-Match', cached.etag)
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    method: 'GET',
    headers,
  })

  if (response.status === 304 && cached) {
    return cached.data as T
  }

  const rawText = await response.text()
  const data = parseJsonSafely(rawText) as Record<string, unknown> | null

  if (!response.ok) {
    throw new Error((data?.error as string) || 'Request failed')
  }

  const etag = response.headers.get('etag')
  if (etag) {
    cachedGetResponses.set(cacheKey, {
      etag,
      data,
    })
  }

  return data as T
}

// Game API
export const gameApi = {
  create: (params: {
    name?: string
    companyName?: string
    industry?: string
    totalRounds?: number
    hoursPerRound?: number
    marketDemandMode?: 'high_competition' | 'balanced' | 'blue_ocean'
    marketDemandMultiplier?: number
    capacityPerFactory?: number
    configOverrides?: GameConfigOverrides
    regionDemandSplit?: { us: number; asia: number; europe: number }
    timezone?: string
    regionLabels?: { us: string; asia: string; europe: string }
    teams?: Array<{ name: string; isAI: boolean; aiDifficulty?: 'easy' | 'medium' | 'hard' }>
  }) =>
    request<{
      success: boolean
      creditsRemaining?: number
      game: {
        id: string
        gameCode: string
        gamePin: string
        name: string
        status: string
        currentRound: number
        roundDeadline: string | null
        timezone?: string
        regionLabels?: { us: string; asia: string; europe: string }
        gameConfig?: GameConfigSnapshot | null
        teams: Array<{
          id: string
          teamCode: string
          teamPin: string
          name: string
          color: string
          isComputer: boolean
        }>
      }
    }>('/games', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Educator login with game code and PIN
  login: (gameCode: string, gamePin: string) =>
    request<{
      success: boolean
      game: {
        id: string
        gameCode: string
        name: string
        status: string
        companyName: string
        industry: string
        totalRounds: number
        currentRound: number
        roundDeadline?: string | null
        timezone?: string
        regionLabels?: { us: string; asia: string; europe: string }
        regionDemandSplit?: { us: number; asia: number; europe: number }
        scenarioSequence?: number[]
        marketDemandMode?: string
        marketDemandMultiplier?: number
        gameConfig?: GameConfigSnapshot | null
        teams: Array<{
          id: string
          teamCode: string
          name: string
          color: string
          isComputer: boolean
        }>
      }
    }>('/games/login', {
      method: 'POST',
      body: JSON.stringify({ gameCode, gamePin }),
    }),

  // Deprecated - use login instead
  getByCode: (gameCode: string) =>
    request<{
      success: boolean
      game: {
        id: string
        gameCode: string
        name: string
        status: string
        companyName: string
        industry: string
        totalRounds: number
        currentRound: number
        roundDeadline?: string | null
        timezone?: string
        regionLabels?: { us: string; asia: string; europe: string }
        marketDemandMode?: string
        marketDemandMultiplier?: number
        gameConfig?: GameConfigSnapshot | null
        teams: Array<{
          id: string
          teamCode: string
          name: string
          color: string
          isComputer: boolean
        }>
      }
    }>(`/games/code/${gameCode}`),

  get: (gameId: string, options?: { mode?: 'full' | 'lite' }) =>
    request<{ success: boolean; game: unknown }>(
      `/games/${gameId}${options?.mode ? `?mode=${options.mode}` : ''}`
    ),

  start: (gameId: string) =>
    request<{ success: boolean; game: unknown }>(`/games/${gameId}/start`, {
      method: 'POST',
    }),

  archive: (gameId: string) =>
    request<{ success: boolean; game: unknown }>(`/games/${gameId}/archive`, {
      method: 'POST',
    }),

  unarchive: (gameId: string) =>
    request<{ success: boolean; game: unknown }>(`/games/${gameId}/unarchive`, {
      method: 'POST',
    }),

  advance: (gameId: string, force: boolean = false) =>
    request<{ success: boolean; currentRound?: number; completed?: boolean }>(
      `/games/${gameId}/advance${force ? '?force=true' : ''}`,
      { method: 'POST' }
    ),

  calculateRound: (gameId: string) =>
    request<{
      success: boolean
      results: {
        round: number
        marketDemand: { us: number; asia: number; europe: number; total: number }
        teams: Array<{
          teamId: string
          teamName: string
          rank: number
          sharePrice: number
          tsr: number
          revenue: number
          netProfit: number
        }>
        winner: {
          byRevenue: number
          byProfit: number
          byMarketShare: number
          byTSR: number
        }
      }
    }>(`/games/${gameId}/calculate-round`, { method: 'POST' }),
}

// Team API
export const teamApi = {
  login: (teamCode: string, teamPin: string) =>
    request<{
      success: boolean
      team: {
        id: string
        teamCode: string
        name: string
        color: string
        isComputer: boolean
        introSeen?: boolean
      }
      game: {
        id: string
        gameCode: string
        name: string
        status: string
        companyName: string
        industry: string
        totalRounds: number
        currentRound: number
        roundDeadline: string | null
        scenarioSequence: number[]
        marketDemandMode?: string
        marketDemandMultiplier?: number
        capacityPerFactory?: number
        gameConfig?: GameConfigSnapshot | null
        totalTeams: number
      }
      currentState: unknown
    }>('/teams/login', {
      method: 'POST',
      body: JSON.stringify({ teamCode, teamPin }),
    }),

  getState: (teamId: string) =>
    request<{
      success: boolean
      state: unknown
      game: {
        currentRound: number
        status: string
        roundDeadline: string | null
        resultsVersion?: number
      }
    }>(`/teams/${teamId}/state`),

  getDecision: (teamId: string, roundNumber: number) =>
    request<{ success: boolean; decision: unknown }>(
      `/teams/${teamId}/decision/${roundNumber}`
    ),

  saveDecision: (
    teamId: string,
    roundNumber: number,
    decision: Record<string, unknown>
  ) =>
    request<{ success: boolean; decision: unknown }>(
      `/teams/${teamId}/decision/${roundNumber}`,
      {
        method: 'PUT',
        body: JSON.stringify(decision),
      }
    ),

  submitDecision: (teamId: string, roundNumber: number) =>
    request<{ success: boolean; decision: unknown }>(
      `/teams/${teamId}/decision/${roundNumber}/submit`,
      { method: 'POST' }
    ),

  markIntroSeen: (teamId: string) =>
    request<{ success: boolean }>(`/teams/${teamId}/intro-seen`, {
      method: 'POST',
    }),

  getResults: (
    teamId: string,
    mode: 'full' | 'metadata' | 'summary' = 'full',
    sourcePage?: string,
    options?: { latestOnly?: boolean; version?: number | string }
  ) => {
    const query = new URLSearchParams({ mode })
    if (options?.latestOnly) {
      query.set('latestOnly', '1')
    }
    if (options?.version !== undefined && options?.version !== null) {
      query.set('v', String(options.version))
    }
    return requestGetWithEtag<{ success: boolean; results: unknown[] }>(`/teams/${teamId}/results?${query.toString()}`, {
      headers: sourcePage ? { 'X-Client-Page': sourcePage } : undefined,
    })
  },
}


export const adminApi = {
  listGames: (options?: { includeArchived?: boolean; includeCounts?: boolean }) =>
    request<{
      success: boolean
      counts?: {
        active: number
        archived: number
      }
      games: Array<{
        id: string
        gameCode: string
        gamePin: string
        name: string
        status: string
        currentRound: number
        totalRounds: number
        marketDemandMode?: string
        marketDemandMultiplier?: number
        capacityPerFactory?: number
        regionDemandSplit?: { us: number; asia: number; europe: number }
        decisionStatus?: {
          totalHumans: number
          submittedHumans: number
          pendingHumans: number
          allHumanSubmitted: boolean
        }
        createdAt: string
        scenarioSequence: number[]
        teams: Array<{
          id: string
          name: string
          teamCode: string
          teamPin: string
          isComputer: boolean
          color: string
        }>
      }>
    }>(`/modlab/games${options?.includeArchived || options?.includeCounts ? `?${new URLSearchParams({
      includeArchived: options?.includeArchived ? 'true' : 'false',
      includeCounts: options?.includeCounts ? 'true' : 'false',
    }).toString()}` : ''}`),
  getGameInsights: (options?: { includeAllMiniSessions?: boolean }) =>
    request<{
      success: boolean
      byDay: Array<{
        date: string
        active: number
        archived: number
      }>
      miniGames?: {
        sessions: Array<{
          id: string
          gameType: string
          title: string | null
          status: string
          teamCount: number
          roomCode: string | null
          createdAt: string
        }>
        totalSessions: number
        includesAll: boolean
        hasMore: boolean
        byType: Array<{
          gameType: string
          count: number
        }>
      }
    }>(`/modlab/games/insights${options?.includeAllMiniSessions ? '?includeAllMiniSessions=true' : ''}`),
  getTransferSummary: () =>
    request<{
      success: boolean
      summary: {
        generatedAt: string
        since: string
        totals: {
          requests: number
          bytesOut: number
          bytesIn: number
        }
        endpointCount: number
        topEndpoints: Array<{
          method: string
          endpoint: string
          requests: number
          bytesOut: number
          bytesIn: number
          avgBytesOut: number
          avgMs: number
          p95Ms: number
          lastStatus: number
          lastSeenAt: string
        }>
      }
    }>('/modlab/transfer-summary'),
  getGameResults: (gameId: string) =>
    request<{
      success: boolean
      results: Array<{
        id: string
        teamId: string
        gameId: string
        roundNumber: number
        fullResults: unknown
        team: {
          id: string
          name: string
          teamCode: string
          teamPin: string
        }
      }>
    }>(`/modlab/games/${gameId}/results`),
  getRoundAudit: (gameId: string, roundNumber: number) =>
    request<{
      success: boolean
      audit: unknown
    }>(`/modlab/games/${gameId}/audit/${roundNumber}`),
  getClaudeAudit: (gameId: string, roundNumber: number) =>
    request<{
      success: boolean
      report: string
    }>(`/modlab/games/${gameId}/claude-audit/${roundNumber}`),
  getRoundDecisions: (gameId: string, roundNumber: number) =>
    request<{
      success: boolean
      decisions: Array<{
        teamId: string
        teamName: string
        roundNumber: number
        isSubmitted: boolean
        submittedAt: string | null
        production: unknown
        hr: unknown
        rnd: unknown
        investment: unknown
        logistics: unknown
        marketing: unknown
        finance: unknown
      }>
    }>(`/modlab/games/${gameId}/decisions/${roundNumber}`),
  getConsistencyReport: (gameId?: string) =>
    request<{
      success: boolean
      generatedAt: string
      summary: Array<{
        gameId: string
        gameName: string
        gameCreatedAt?: string | null
        roundNumber: number
        totalTeams: number
        issueCount: number
      }>
      issues: Array<{
        gameId: string
        gameName: string
        roundNumber: number
        teamId?: string
        teamName?: string
        check: string
        severity: 'warning' | 'error'
        message: string
        baselineRoundMinus1State?: unknown
      }>
      rawRounds: Array<{
        gameId: string
        rounds: Array<{
          roundNumber: number
          teams: Array<{
            teamId: string
            teamName: string
            roundMinus1: {
              gameState: unknown | null
              teamRoundResult: unknown | null
            }
            roundData: {
              gameState: unknown | null
              teamRoundResult: unknown | null
            }
          }>
        }>
      }>
    }>(`/modlab/games/consistency${gameId ? `?gameId=${gameId}` : ''}`),
  recalculateRound: (gameId: string, roundNumber: number) =>
    request<{ success: boolean }>(
      `/modlab/games/${gameId}/recalculate/${roundNumber}`,
      { method: 'POST' }
    ),
  resetGameFromRound: (gameId: string, roundNumber: number) =>
    request<{ success: boolean }>(
      `/modlab/games/${gameId}/reset/${roundNumber}`,
      { method: 'POST' }
    ),
  createAdmin: (username: string, password: string) =>
    request<{ success: boolean; admin: { id: string; username: string } }>('/modlab/users', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  listAdmins: () => request<{ success: boolean; admins: { id: string; username: string; createdAt: string }[] }>('/modlab/users'),
  changeAdminPassword: (username: string, password: string) =>
    request<{ success: boolean }>('/modlab/password', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  createEducator: (email: string, pin: string, credits: number) =>
    request<{ success: boolean; educator: EducatorApiUser }>('/modlab/educators', {
      method: 'POST',
      body: JSON.stringify({ email, pin, credits }),
    }),
  listEducators: () => request<{ success: boolean; educators: EducatorApiUser[] }>('/modlab/educators'),
  updateEducatorCredits: (id: string, amount: number, mode: 'add' | 'set') =>
    request<{ success: boolean; educator: EducatorApiUser }>(`/modlab/educators/${id}/credits`, {
      method: 'PUT',
      body: JSON.stringify({ amount, mode }),
    }),
  updateEducatorPin: (id: string, pin: string) =>
    request<{ success: boolean; educator: EducatorApiUser }>(`/modlab/educators/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pin }),
    }),
  deleteEducator: (id: string) =>
    request<{ success: boolean }>(`/modlab/educators/${id}`, {
      method: 'DELETE',
    }),
  deleteAdmin: (id: string) =>
    request<{ success: boolean }>(`/modlab/users/${id}`, {
      method: 'DELETE',
    }),
  getEducatorTransactions: (id: string) =>
    request<{ success: boolean; transactions: EducatorApiTransaction[] }>(`/modlab/educators/${id}/transactions`),
}

export const authApi = {
  me: (role?: 'team' | 'educator' | 'admin') =>
    request<{
      success: boolean
      role?: 'team' | 'educator' | 'admin'
      team?: {
        id: string
        teamCode: string
        name: string
        color: string
        isComputer: boolean
        introSeen?: boolean
      }
      game?: {
        id: string
        gameCode: string
        name: string
        status: string
        companyName: string
        industry: string
        totalRounds: number
        currentRound: number
        roundDeadline?: string | null
        scenarioSequence?: number[]
        marketDemandMode?: string
        marketDemandMultiplier?: number
        regionLabels?: { us: string; asia: string; europe: string }
        gameConfig?: GameConfigSnapshot | null
        teams?: Array<{
          id: string
          teamCode: string
          name: string
          color: string
          isComputer: boolean
        }>
        totalTeams?: number
      }
      currentState?: unknown
    }>(`/auth/me${role ? `?role=${role}` : ''}`),
  adminLogin: (username: string, password: string) =>
    request<{ success: boolean }>('/auth/modlab/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: (role?: 'team' | 'educator' | 'admin') =>
    request<{ success: boolean }>(`/auth/logout${role ? `?role=${role}` : ''}`, {
      method: 'POST',
    }),
}

export const educatorApi = {
  login: (email: string, pin: string) =>
    request<{ success: boolean; educator: { id: string; email: string; credits: number } }>('/auth/educator/login', {
      method: 'POST',
      body: JSON.stringify({ email, pin }),
    }),
  listMyGames: () =>
    request<{ success: boolean; games: EducatorOwnedGame[] }>('/educator/games'),
  addExistingGame: (gameCode: string, gamePin: string) =>
    request<{ success: boolean; message: string; credits?: number }>('/educator/games/add', {
      method: 'POST',
      body: JSON.stringify({ gameCode, gamePin }),
    }),
  getGameResults: (gameId: string) =>
    request<{ success: boolean; results: EducatorGameResult[] }>(`/educator/games/${gameId}/results`),
  updateMyPin: (newPin: string) =>
    request<{ success: boolean; message: string }>('/educator/pin', {
      method: 'PUT',
      body: JSON.stringify({ newPin }),
    }),
  listMiniGameSessions: () =>
    request<{ success: boolean; sessions: EducatorMiniGameSession[] }>('/educator/minigames'),
  createMiniGameSession: (payload: {
    gameType: MiniGameTypeSlug
    title?: string
    teamCount?: number
    configJson?: Record<string, unknown>
    roomCode?: string
    hostToken?: string
  }) =>
    request<{
      success: boolean
      session: {
        id: string
        gameType: MiniGameTypeSlug
        title: string | null
        status: 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
        teamCount: number
        roomCode: string | null
        hostToken: string | null
        createdAt: string
        joinByCodeLink?: string
        hostLink: string
      }
      creditsRemaining?: number
      links: Array<{ inviteId: string; teamLabel: string; playLink: string }>
    }>('/educator/minigames', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMiniGameSessionLinks: (sessionId: string) =>
    request<{
      success: boolean
      session: {
        id: string
        gameType: MiniGameTypeSlug
        title: string | null
        roomCode: string | null
        hostToken: string | null
        joinByCodeLink?: string
        hostLink: string
      }
      links: Array<{ inviteId: string; teamLabel: string; playLink: string }>
    }>(`/educator/minigames/${sessionId}/links`),
  getMiniGameSessionPlayers: (sessionId: string) =>
    request<{
      success: boolean
      session: {
        id: string
        gameType: MiniGameTypeSlug
        status: string
        teamCount: number
      }
      players: EducatorMiniGamePlayer[]
    }>(`/educator/minigames/${sessionId}/players`),
  runMiniGameHostAction: (sessionId: string, action: 'start' | 'advance' | 'reset') =>
    request<{
      success: boolean
      action: 'start' | 'advance' | 'reset'
      sessionId: string
      gameType: MiniGameTypeSlug
      state: unknown
    }>(`/educator/minigames/${sessionId}/host/${action}`, {
      method: 'POST',
    }),
}

export const miniGamesApi = {
  createBankRunRoom: () =>
    request<{ success: boolean; roomCode: string; hostToken: string; session: unknown }>('/minigames/bank-run/create', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  createFisheryRoom: (config?: { mode?: 'classic' | 'quota'; rounds?: number; capacityPerPlayer?: number; quotaPerPlayer?: number }) =>
    request<{ success: boolean; roomCode: string; hostToken: string; session: unknown }>('/minigames/fishery/create', {
      method: 'POST',
      body: JSON.stringify({ config: config ?? {} }),
    }),
  createDoubleAuctionRoom: (config?: { rounds?: number; minPrice?: number; maxPrice?: number }) =>
    request<{ success: boolean; roomCode: string; hostToken: string; session: unknown }>('/minigames/double-auction/create', {
      method: 'POST',
      body: JSON.stringify({ config: config ?? {} }),
    }),
  resolveInvite: (inviteToken: string) =>
    request<{
      success: boolean
      invite: {
        teamLabel: string
        gameType: MiniGameTypeSlug
        title: string | null
        roomCode: string | null
      }
    }>(`/minigames/invite/${inviteToken}`),
  resolveRoomCode: (roomCode: string) =>
    request<{
      success: boolean
      room: {
        roomCode: string
        gameType: MiniGameTypeSlug
        title: string | null
        status?: string
        teamCount?: number
        config?: {
          creditScore?: {
            difficulty?: 'easy' | 'hard'
            preset?: 'student'
          } | null
        }
      }
    }>(`/minigames/join/${encodeURIComponent(roomCode)}`),
}

export const tournamentApi = {
  list: () =>
    request<{ success: boolean; tournaments: TournamentSummary[] }>('/tournaments'),

  create: (name: string, teamNames: string[], config?: { industry?: string; totalRounds?: number; hoursPerRound?: number | null }) =>
    request<{ success: boolean; tournament: TournamentSummary }>('/tournaments', {
      method: 'POST',
      body: JSON.stringify({ name, teamNames, ...config })
    }),

  createFinal: (id: string) =>
    request<{ success: boolean; message: string }>(`/tournaments/${id}/create-final`, {
      method: 'POST'
    }),

  archive: (id: string) =>
    request<{ success: boolean }>(`/tournaments/${id}/archive`, {
      method: 'POST'
    }),

  unarchive: (id: string) =>
    request<{ success: boolean }>(`/tournaments/${id}/unarchive`, {
      method: 'POST'
    })
}

export const publicApi = {
  getInvoice: (txId: string) =>
    request<{ success: boolean; transaction: PublicInvoiceTransaction }>(`/public/invoice/${txId}`),
}
