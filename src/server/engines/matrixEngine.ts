/**
 * Matrix Game Engine
 * Powers: Prisoner's Dilemma, Matching Pennies
 *
 * Two players simultaneously choose a strategy each round.
 * Payoffs are determined by a configurable NxN payoff matrix.
 */

export type MatrixConfig = {
  gameName: string
  strategies: string[]           // e.g. ['Cooperate', 'Defect']
  payoffs: number[][][]          // [rowIdx][colIdx] = [rowPlayerPayoff, colPlayerPayoff]
  rounds: number
  botStrategy: 'random' | 'tit-for-tat' | 'always-defect' | 'always-cooperate'
}

export type MatrixPlayer = {
  id: string
  name: string
  isBot: boolean
  role: 'row' | 'col'
  totalScore: number
  hasActedThisRound: boolean
  lastChoice?: string
}

export type MatrixRoundSummary = {
  round: number
  choices: Record<string, string>        // playerId → strategy name
  payoffs: Record<string, number>        // playerId → payoff this round
  rowChoice: string
  colChoice: string
  rowPayoff: number
  colPayoff: number
}

export type MatrixSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  currentRound: number
  config: MatrixConfig
  players: MatrixPlayer[]
  roundChoices: Record<number, Record<string, string>>  // round → playerId → strategy
  history: MatrixRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000

// --- Session map ---
const sessions = new Map<string, MatrixSession>()

export function cleanupMatrixSessions(): void {
  const now = Date.now()
  for (const [code, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TTL_MS) {
      sessions.delete(code)
    }
  }
}

export function getMatrixSession(roomCode: string): MatrixSession | undefined {
  cleanupMatrixSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setMatrixSession(session: MatrixSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

// --- Factory ---
export function createMatrixSession(
  roomCode: string,
  hostToken: string,
  config: MatrixConfig
): MatrixSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    currentRound: 1,
    config,
    players: [],
    roundChoices: {},
    history: [],
    eventLog: [`Game created. Waiting for players...`],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addMatrixPlayer(
  session: MatrixSession,
  id: string,
  name: string,
  isBot = false
): MatrixPlayer {
  // Assign roles: first player = row, second = col (cycle for more players if needed)
  const rowCount = session.players.filter(p => p.role === 'row').length
  const colCount = session.players.filter(p => p.role === 'col').length
  const role: 'row' | 'col' = rowCount <= colCount ? 'row' : 'col'

  const player: MatrixPlayer = {
    id, name, isBot, role,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined as ${role} player.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

// --- Bot action ---
export function getBotChoice(
  session: MatrixSession,
  bot: MatrixPlayer
): string {
  const { strategies, botStrategy } = session.config
  const opponentRole = bot.role === 'row' ? 'col' : 'row'
  const opponent = session.players.find(p => p.role === opponentRole)

  if (botStrategy === 'tit-for-tat') {
    if (!opponent?.lastChoice) return strategies[0]  // Start with cooperate (index 0)
    return opponent.lastChoice
  }
  if (botStrategy === 'always-defect') return strategies[strategies.length - 1]
  if (botStrategy === 'always-cooperate') return strategies[0]
  // random
  return strategies[Math.floor(Math.random() * strategies.length)]
}

// --- Record a choice ---
export function recordMatrixChoice(
  session: MatrixSession,
  playerId: string,
  strategy: string
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (!session.config.strategies.includes(strategy)) {
    return { ok: false, error: 'Invalid strategy' }
  }
  if (player.hasActedThisRound) return { ok: false, error: 'Already submitted this round' }

  const round = session.currentRound
  if (!session.roundChoices[round]) session.roundChoices[round] = {}
  session.roundChoices[round][playerId] = strategy
  player.hasActedThisRound = true
  session.eventLog.push(`${player.name} made their choice.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

// --- Check if round is complete ---
export function isRoundComplete(session: MatrixSession): boolean {
  const humanPlayers = session.players.filter(p => !p.isBot)
  return humanPlayers.every(p => p.hasActedThisRound)
}

// --- Process round (called by host advance OR auto when all acted) ---
export function processMatrixRound(session: MatrixSession): void {
  const round = session.currentRound
  const choices = session.roundChoices[round] || {}

  // Fill in bot choices
  for (const bot of session.players.filter(p => p.isBot)) {
    if (!choices[bot.id]) {
      choices[bot.id] = getBotChoice(session, bot)
      session.roundChoices[round] = choices
    }
  }

  // Find row and col players (take first of each for simplicity in 2-player game)
  const rowPlayer = session.players.find(p => p.role === 'row')
  const colPlayer = session.players.find(p => p.role === 'col')

  if (!rowPlayer || !colPlayer) return

  const rowChoice = choices[rowPlayer.id] ?? session.config.strategies[0]
  const colChoice = choices[colPlayer.id] ?? session.config.strategies[0]

  const rowIdx = session.config.strategies.indexOf(rowChoice)
  const colIdx = session.config.strategies.indexOf(colChoice)

  const [rowPayoff, colPayoff] = session.config.payoffs[rowIdx]?.[colIdx] ?? [0, 0]

  rowPlayer.totalScore += rowPayoff
  colPlayer.totalScore += colPayoff
  rowPlayer.lastChoice = rowChoice
  colPlayer.lastChoice = colChoice

  const summary: MatrixRoundSummary = {
    round,
    choices,
    payoffs: { [rowPlayer.id]: rowPayoff, [colPlayer.id]: colPayoff },
    rowChoice, colChoice, rowPayoff, colPayoff,
  }
  session.history.push(summary)

  session.eventLog.push(
    `Round ${round}: ${rowPlayer.name} chose ${rowChoice}, ${colPlayer.name} chose ${colChoice}. ` +
    `Payoffs: ${rowPlayer.name} +${rowPayoff}, ${colPlayer.name} +${colPayoff}.`
  )
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset for next round
  for (const p of session.players) p.hasActedThisRound = false

  if (round >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}

// --- Preset game configs ---
export const PRISONERS_DILEMMA_CONFIG: MatrixConfig = {
  gameName: "Prisoner's Dilemma",
  strategies: ['Cooperate', 'Defect'],
  // Row/Col: [rowPayoff, colPayoff]
  // (C,C)=3,3  (C,D)=0,5  (D,C)=5,0  (D,D)=1,1
  payoffs: [
    [[3, 3], [0, 5]],   // Row plays Cooperate
    [[5, 0], [1, 1]],   // Row plays Defect
  ],
  rounds: 6,
  botStrategy: 'tit-for-tat',
}

export const MATCHING_PENNIES_CONFIG: MatrixConfig = {
  gameName: 'Matching Pennies',
  strategies: ['Heads', 'Tails'],
  // (H,H)=1,-1  (H,T)=-1,1  (T,H)=-1,1  (T,T)=1,-1
  payoffs: [
    [[1, -1], [-1, 1]],  // Row plays Heads
    [[-1, 1], [1, -1]],  // Row plays Tails
  ],
  rounds: 10,
  botStrategy: 'random',
}
