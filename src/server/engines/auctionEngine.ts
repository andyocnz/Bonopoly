/**
 * Auction Game Engine
 * Powers: English Auction (ascending price)
 *
 * Private values are drawn uniformly for each bidder.
 * Host advances the price each step.
 * Bidders declare 'stay' or 'drop' at each price level.
 * Last remaining bidder wins at the current price.
 * Efficient: winner is the highest-value bidder.
 */

export type AuctionConfig = {
  numBidders: number
  valueMin: number      // Minimum private value (e.g. 10)
  valueMax: number      // Maximum private value (e.g. 100)
  startingPrice: number // Starting clock price (e.g. 5)
  priceStep: number     // How much price rises per advance (e.g. 5)
  rounds: number        // Number of separate auctions to run
}

export type AuctionBidder = {
  id: string
  name: string
  isBot: boolean
  privateValue: number     // Hidden from others
  status: 'active' | 'dropped' | 'winner'
  dropPrice?: number       // Price at which they dropped out
  profit: number           // Sum across rounds
  hasRespondedThisStep: boolean
}

export type AuctionRoundSummary = {
  round: number
  winnerId?: string
  winnerName?: string
  winningPrice?: number
  winnerValue?: number
  winnerProfit?: number
  allValues: Record<string, number>    // revealed at end of round
  dropPrices: Record<string, number>
  noWinner: boolean                    // True if all dropped before 1 remained
}

export type AuctionSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: AuctionConfig
  bidders: AuctionBidder[]
  currentRound: number
  currentPrice: number
  roundStep: 'bidding' | 'advancing' | 'roundComplete'
  history: AuctionRoundSummary[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map<string, AuctionSession>()

export function cleanupAuctionSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getAuctionSession(roomCode: string): AuctionSession | undefined {
  cleanupAuctionSessions()
  return sessions.get(roomCode.toUpperCase())
}

export function setAuctionSession(session: AuctionSession): void {
  session.lastActivityAt = Date.now()
  sessions.set(session.roomCode, session)
}

function drawPrivateValues(config: AuctionConfig, n: number): number[] {
  return Array.from({ length: n }, () =>
    Math.round(config.valueMin + Math.random() * (config.valueMax - config.valueMin))
  )
}

export function createAuctionSession(
  roomCode: string,
  hostToken: string,
  config: AuctionConfig
): AuctionSession {
  return {
    roomCode: roomCode.toUpperCase(),
    hostToken,
    phase: 'lobby',
    config,
    bidders: [],
    currentRound: 1,
    currentPrice: config.startingPrice,
    roundStep: 'bidding',
    history: [],
    eventLog: ['Auction created. Waiting for bidders...'],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

export function addAuctionBidder(
  session: AuctionSession,
  id: string,
  name: string,
  isBot = false
): AuctionBidder {
  const bidder: AuctionBidder = {
    id, name, isBot,
    privateValue: 0,    // Assigned when game starts
    status: 'active',
    profit: 0,
    hasRespondedThisStep: false,
  }
  session.bidders.push(bidder)
  session.eventLog.push(`${name} joined the auction.`)
  if (session.eventLog.length > 40) session.eventLog.shift()
  return bidder
}

// Assign private values when the game starts
export function assignPrivateValues(session: AuctionSession): void {
  const values = drawPrivateValues(session.config, session.bidders.length)
  session.bidders.forEach((b, i) => { b.privateValue = values[i] })
  session.currentPrice = session.config.startingPrice
}

export function getActiveBidders(session: AuctionSession): AuctionBidder[] {
  return session.bidders.filter(b => b.status === 'active')
}

// Bidder declares 'stay' or 'drop' at current price
export function submitBid(
  session: AuctionSession,
  bidderId: string,
  action: 'stay' | 'drop'
): { ok: boolean; error?: string } {
  if (session.roundStep !== 'bidding') return { ok: false, error: 'Not in bidding phase' }

  const bidder = session.bidders.find(b => b.id === bidderId)
  if (!bidder) return { ok: false, error: 'Bidder not found' }
  if (bidder.status !== 'active') return { ok: false, error: 'Not an active bidder' }

  if (action === 'drop') {
    bidder.status = 'dropped'
    bidder.dropPrice = session.currentPrice
    bidder.hasRespondedThisStep = true
    session.eventLog.push(`${bidder.name} dropped out at price ${session.currentPrice}.`)
  } else {
    bidder.hasRespondedThisStep = true
    session.eventLog.push(`${bidder.name} stays in at price ${session.currentPrice}.`)
  }
  if (session.eventLog.length > 40) session.eventLog.shift()

  // Check if round is resolved (0 or 1 active bidder left)
  checkRoundResolution(session)
  return { ok: true }
}

// Called by host to advance price (or auto-advance if all bots)
export function advanceAuctionPrice(session: AuctionSession): void {
  if (session.roundStep !== 'advancing') return

  // Bot logic: drop when price exceeds private value
  for (const bot of session.bidders.filter(b => b.isBot && b.status === 'active')) {
    if (session.currentPrice >= bot.privateValue) {
      bot.status = 'dropped'
      bot.dropPrice = session.currentPrice
    }
    bot.hasRespondedThisStep = true
  }

  session.currentPrice += session.config.priceStep
  // Reset response flags
  for (const b of session.bidders.filter(b => b.status === 'active')) {
    b.hasRespondedThisStep = false
  }
  session.roundStep = 'bidding'
  session.eventLog.push(`Price rises to ${session.currentPrice}.`)
  if (session.eventLog.length > 40) session.eventLog.shift()

  checkRoundResolution(session)
}

function checkRoundResolution(session: AuctionSession): void {
  const active = getActiveBidders(session)

  if (active.length === 1) {
    // Winner!
    const winner = active[0]
    winner.status = 'winner'
    const winningPrice = session.currentPrice
    const winnerProfit = winner.privateValue - winningPrice

    winner.profit += winnerProfit

    const dropPrices: Record<string, number> = {}
    for (const b of session.bidders) {
      if (b.dropPrice !== undefined) dropPrices[b.id] = b.dropPrice
    }
    const allValues: Record<string, number> = {}
    for (const b of session.bidders) allValues[b.id] = b.privateValue

    session.history.push({
      round: session.currentRound,
      winnerId: winner.id,
      winnerName: winner.name,
      winningPrice,
      winnerValue: winner.privateValue,
      winnerProfit,
      allValues,
      dropPrices,
      noWinner: false,
    })

    session.eventLog.push(
      `${winner.name} wins Round ${session.currentRound} at price ${winningPrice}! ` +
      `(Value: ${winner.privateValue}, Profit: ${winnerProfit})`
    )
    if (session.eventLog.length > 40) session.eventLog.shift()

    advanceToNextRound(session)
    return
  }

  if (active.length === 0) {
    // All dropped — no winner
    const dropPrices: Record<string, number> = {}
    for (const b of session.bidders) {
      if (b.dropPrice !== undefined) dropPrices[b.id] = b.dropPrice
    }
    const allValues: Record<string, number> = {}
    for (const b of session.bidders) allValues[b.id] = b.privateValue

    session.history.push({
      round: session.currentRound,
      noWinner: true,
      allValues,
      dropPrices,
    })
    session.eventLog.push(`Round ${session.currentRound}: No winner — all bidders dropped.`)
    if (session.eventLog.length > 40) session.eventLog.shift()
    advanceToNextRound(session)
    return
  }

  // Check if all remaining active have responded → move to advancing phase
  const allHumanResponded = active.filter(b => !b.isBot).every(b => b.hasRespondedThisStep)
  if (allHumanResponded) {
    session.roundStep = 'advancing'
  }
}

function advanceToNextRound(session: AuctionSession): void {
  if (session.currentRound >= session.config.rounds) {
    session.phase = 'results'
    session.eventLog.push('All auctions complete!')
  } else {
    session.currentRound += 1
    session.roundStep = 'bidding'
    // Reset bidders and assign new values
    for (const b of session.bidders) {
      b.status = 'active'
      b.dropPrice = undefined
      b.hasRespondedThisStep = false
    }
    assignPrivateValues(session)
    session.eventLog.push(`Round ${session.currentRound} begins. New values assigned.`)
  }
  if (session.eventLog.length > 40) session.eventLog.shift()
}
