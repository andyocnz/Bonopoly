/**
 * Adverse Selection Engine — Market for Lemons
 *
 * All students are sellers. Each is assigned a private quality (Low=40, Med=70, High=100).
 * Each round: seller decides Enter or Stay Out.
 * Server simulates a buyer whose WTP = average quality of entering sellers.
 * Trade occurs if WTP >= fixed price P.
 *
 * Payoffs:
 *   - Seller who enters AND buyer buys: P − quality (profit = price minus cost)
 *   - Seller who enters but no trade: 0
 *   - Seller who stays out: 0
 */

export type AdverseSelectionConfig = {
  price: number          // Fixed price P (default 60)
  qualityLevels: number[] // [40, 70, 100]
  rounds: number
  roundScenarios?: Array<{
    label: string
    price: number
    buyerThreshold: number
    qualityFloor: number | null
  }>
}

export type AdverseSelectionPlayer = {
  id: string
  name: string
  isBot: boolean
  quality: number        // Private — not revealed to others
  totalScore: number
  hasActedThisRound: boolean
  enteredThisRound?: boolean
}

export type AdverseSelectionRoundSummary = {
  round: number
  scenarioLabel: string
  price: number
  buyerThreshold: number
  qualityFloor: number | null
  entrantCount: number
  avgQualityOfEntrants: number | null
  buyerBought: boolean
  results: Array<{
    playerId: string
    playerName: string
    quality: number
    entered: boolean
    roundPayoff: number
  }>
}

export type AdverseSelectionSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: AdverseSelectionConfig
  players: AdverseSelectionPlayer[]
  currentRound: number
  history: AdverseSelectionRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, AdverseSelectionSession>()

export function cleanupAdverseSelectionSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function addAdverseSelectionPlayer(
  session: AdverseSelectionSession,
  id: string,
  name: string,
  isBot = false
): AdverseSelectionPlayer {
  const qualityLevels = session.config.qualityLevels
  const quality = qualityLevels[Math.floor(Math.random() * qualityLevels.length)]
  const player: AdverseSelectionPlayer = {
    id, name, isBot, quality,
    totalScore: 0,
    hasActedThisRound: false,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return player
}

export function getAdverseSelectionScenario(session: AdverseSelectionSession): {
  label: string
  price: number
  buyerThreshold: number
  qualityFloor: number | null
} {
  const scenario = session.config.roundScenarios?.[Math.max(0, session.currentRound - 1)]
  if (scenario) return scenario
  return {
    label: 'Baseline market',
    price: session.config.price,
    buyerThreshold: session.config.price,
    qualityFloor: null,
  }
}

export function submitAdverseSelectionAction(
  session: AdverseSelectionSession,
  playerId: string,
  enter: boolean
): { ok: boolean; error?: string } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (player.hasActedThisRound) return { ok: false, error: 'Already acted this round' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }

  player.enteredThisRound = enter
  player.hasActedThisRound = true
  session.eventLog.push(`${player.name} made their decision.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return { ok: true }
}

export function isAdverseSelectionRoundComplete(session: AdverseSelectionSession): boolean {
  return session.players.filter(p => !p.isBot).every(p => p.hasActedThisRound)
}

export function processAdverseSelectionRound(session: AdverseSelectionSession): void {
  const scenario = getAdverseSelectionScenario(session)
  const { price, buyerThreshold, qualityFloor } = scenario

  // Bots: high quality stays out (quality > price → loss), low/med enters
  for (const bot of session.players.filter(p => p.isBot && !p.hasActedThisRound)) {
    const wantsToEnter = bot.quality <= price
    const allowedByFloor = qualityFloor === null || bot.quality >= qualityFloor
    bot.enteredThisRound = wantsToEnter && allowedByFloor
    bot.hasActedThisRound = true
  }

  const entrants = session.players.filter((p) => {
    if (!p.enteredThisRound) return false
    if (qualityFloor === null) return true
    return p.quality >= qualityFloor
  })
  const avgQ = entrants.length > 0
    ? entrants.reduce((s, p) => s + p.quality, 0) / entrants.length
    : null

  const buyerBought = avgQ !== null && avgQ >= buyerThreshold

  const results: AdverseSelectionRoundSummary['results'] = []
  for (const p of session.players) {
    const entered = !!p.enteredThisRound
    let roundPayoff = 0
    if (entered && buyerBought) {
      roundPayoff = price - p.quality
    }
    p.totalScore += roundPayoff
    results.push({ playerId: p.id, playerName: p.name, quality: p.quality, entered, roundPayoff })
  }

  const summary: AdverseSelectionRoundSummary = {
    round: session.currentRound,
    scenarioLabel: scenario.label,
    price,
    buyerThreshold,
    qualityFloor,
    entrantCount: entrants.length,
    avgQualityOfEntrants: avgQ !== null ? Math.round(avgQ * 10) / 10 : null,
    buyerBought,
    results,
  }
  session.history.push(summary)

  const msg = buyerBought
    ? `Round ${session.currentRound} (${scenario.label}): Avg quality ${avgQ!.toFixed(1)} ≥ threshold ${buyerThreshold}. Buyer bought! ${entrants.length} seller(s) traded.`
    : avgQ !== null
      ? `Round ${session.currentRound} (${scenario.label}): Avg quality ${avgQ!.toFixed(1)} < threshold ${buyerThreshold}. No trade.`
      : `Round ${session.currentRound} (${scenario.label}): No sellers entered. No trade.`
  session.eventLog.push(msg)
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Reset
  for (const p of session.players) {
    p.hasActedThisRound = false
    p.enteredThisRound = undefined
  }

  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('Game complete!')
  } else {
    session.currentRound += 1
  }
}
