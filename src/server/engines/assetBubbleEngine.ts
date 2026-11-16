/**
 * Asset Bubble Engine
 *
 * Full real-time order book. Asset pays a dividend each period.
 * Fundamental value = remaining periods × dividend (declines each period).
 * Players post bids/asks; server matches immediately when best bid ≥ best ask.
 *
 * Config: 10 periods, dividend=10, cashEndowment=500, assetEndowment=4 per player.
 * FV at period k: (totalPeriods − k + 1) × dividend
 *   Period 1 → 100, Period 5 → 60, Period 10 → 10
 */

export type AssetBubbleConfig = {
  totalPeriods: number      // default 10
  dividend: number          // default 10 per period
  cashEndowment: number     // default 500
  assetEndowment: number    // default 4 per player
  secondsPerPeriod: number  // default 60
}

export type OrderSide = 'bid' | 'ask'

export type Order = {
  id: string
  playerId: string
  playerName: string
  side: OrderSide
  price: number
  placedAt: number
}

export type Trade = {
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  price: number
  at: number
  period: number
}

export type AssetBubblePlayer = {
  id: string
  name: string
  isBot: boolean
  cash: number
  assets: number
  totalProfit: number     // vs initial endowment value
}

export type PeriodSummary = {
  period: number
  fundamentalValue: number
  trades: Trade[]
  avgTradePrice: number | null
  dividendPaid: number
}

export type ShockEvent = {
  scenario: string   // display text shown to all players
  firedAt: number    // timestamp
}

export type AssetBubbleSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'playing' | 'results'
  config: AssetBubbleConfig
  players: AssetBubblePlayer[]
  currentPeriod: number
  bids: Order[]
  asks: Order[]
  history: PeriodSummary[]
  tradesThisPeriod: Trade[]
  eventLog: string[]
  createdAt: number
  lastActivityAt: number
  periodStartedAt?: number
  shockEvent?: ShockEvent   // set when Minsky Moment fires
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000
const sessions = new Map<string, AssetBubbleSession>()

export function cleanupAssetBubbleSessions(): void {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.lastActivityAt > SESSION_TTL_MS) sessions.delete(code)
  }
}

export function getFundamentalValue(session: AssetBubbleSession, period?: number): number {
  const p = period ?? session.currentPeriod
  const remaining = session.config.totalPeriods - p + 1
  return Math.max(0, remaining * session.config.dividend)
}

export function addAssetBubblePlayer(
  session: AssetBubbleSession,
  id: string,
  name: string,
  isBot = false
): AssetBubblePlayer {
  const player: AssetBubblePlayer = {
    id, name, isBot,
    cash: session.config.cashEndowment,
    assets: session.config.assetEndowment,
    totalProfit: 0,
  }
  session.players.push(player)
  session.eventLog.push(`${name} joined.`)
  if (session.eventLog.length > 60) session.eventLog.shift()
  return player
}

export function placeBid(
  session: AssetBubbleSession,
  playerId: string,
  price: number
): { ok: boolean; error?: string; trade?: Trade } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }
  if (price <= 0) return { ok: false, error: 'Price must be positive' }
  if (player.cash < price) return { ok: false, error: 'Insufficient cash' }

  // Remove existing bid from this player
  session.bids = session.bids.filter(o => o.playerId !== playerId)

  const newBid: Order = {
    id: Math.random().toString(36).slice(2),
    playerId, playerName: player.name,
    side: 'bid', price,
    placedAt: Date.now(),
  }
  session.bids.push(newBid)
  session.bids.sort((a, b) => b.price - a.price || a.placedAt - b.placedAt)

  // Try to match
  let result = tryMatch(session, newBid)
  if (!player.isBot) {
    maintainBotLiquidity(session, { humanSide: 'bid', humanPrice: price })
    if (!result.trade) result = tryMatch(session, newBid)
    drainCrossedBook(session)
  }
  return result
}

export function placeAsk(
  session: AssetBubbleSession,
  playerId: string,
  price: number
): { ok: boolean; error?: string; trade?: Trade } {
  const player = session.players.find(p => p.id === playerId)
  if (!player) return { ok: false, error: 'Player not found' }
  if (session.phase !== 'playing') return { ok: false, error: 'Game not active' }
  if (price <= 0) return { ok: false, error: 'Price must be positive' }
  if (player.assets < 1) return { ok: false, error: 'No assets to sell' }

  // Remove existing ask from this player
  session.asks = session.asks.filter(o => o.playerId !== playerId)

  const newAsk: Order = {
    id: Math.random().toString(36).slice(2),
    playerId, playerName: player.name,
    side: 'ask', price,
    placedAt: Date.now(),
  }
  session.asks.push(newAsk)
  session.asks.sort((a, b) => a.price - b.price || a.placedAt - b.placedAt)

  // Try to match
  let result = tryMatch(session, newAsk)
  if (!player.isBot) {
    maintainBotLiquidity(session, { humanSide: 'ask', humanPrice: price })
    if (!result.trade) result = tryMatch(session, newAsk)
    drainCrossedBook(session)
  }
  return result
}

export function cancelOrder(
  session: AssetBubbleSession,
  playerId: string
): { ok: boolean } {
  const beforeBids = session.bids.length
  const beforeAsks = session.asks.length
  session.bids = session.bids.filter(o => o.playerId !== playerId)
  session.asks = session.asks.filter(o => o.playerId !== playerId)
  const cancelled = session.bids.length < beforeBids || session.asks.length < beforeAsks
  if (cancelled) {
    session.eventLog.push(`${session.players.find(p => p.id === playerId)?.name ?? 'Player'} cancelled their order.`)
    if (session.eventLog.length > 60) session.eventLog.shift()
  }
  return { ok: true }
}

function tryMatch(
  session: AssetBubbleSession,
  newOrder: Order
): { ok: boolean; error?: string; trade?: Trade } {
  void newOrder
  const bestBid = session.bids[0]
  const bestAsk = session.asks[0]

  if (!bestBid || !bestAsk) return { ok: true }
  if (bestBid.price < bestAsk.price) return { ok: true }
  if (bestBid.playerId === bestAsk.playerId) return { ok: true }

  const buyer = session.players.find(p => p.id === bestBid.playerId)
  const seller = session.players.find(p => p.id === bestAsk.playerId)
  if (!buyer || !seller) return { ok: true }

  // Trade at ask price (first-placed order sets price)
  const tradePrice = bestAsk.price
  if (buyer.cash < tradePrice) {
    // Can't afford — remove bid
    session.bids.shift()
    return { ok: true }
  }
  if (seller.assets < 1) {
    session.asks.shift()
    return { ok: true }
  }

  buyer.cash -= tradePrice
  buyer.assets += 1
  seller.cash += tradePrice
  seller.assets -= 1

  session.bids.shift()
  session.asks.shift()

  const trade: Trade = {
    buyerId: buyer.id, buyerName: buyer.name,
    sellerId: seller.id, sellerName: seller.name,
    price: tradePrice,
    at: Date.now(),
    period: session.currentPeriod,
  }
  session.tradesThisPeriod.push(trade)

  const fv = getFundamentalValue(session)
  session.eventLog.push(
    `Trade: ${buyer.name} bought from ${seller.name} @ ${tradePrice} (FV=${fv})`
  )
  if (session.eventLog.length > 60) session.eventLog.shift()

  return { ok: true, trade }
}

function drainCrossedBook(session: AssetBubbleSession, cap = 6): void {
  let remaining = cap
  while (remaining > 0) {
    const bestBid = session.bids[0]
    const bestAsk = session.asks[0]
    if (!bestBid || !bestAsk || bestBid.price < bestAsk.price) break
    const result = tryMatch(session, bestBid)
    if (!result.trade) break
    remaining -= 1
  }
}

function upsertOrder(session: AssetBubbleSession, player: AssetBubblePlayer, side: OrderSide, price: number): void {
  const safePrice = Math.max(1, Math.round(price))
  const now = Date.now()
  if (side === 'bid') {
    session.bids = session.bids.filter(o => o.playerId !== player.id)
    session.bids.push({
      id: Math.random().toString(36).slice(2),
      playerId: player.id,
      playerName: player.name,
      side: 'bid',
      price: safePrice,
      placedAt: now,
    })
    session.bids.sort((a, b) => b.price - a.price || a.placedAt - b.placedAt)
    return
  }

  session.asks = session.asks.filter(o => o.playerId !== player.id)
  session.asks.push({
    id: Math.random().toString(36).slice(2),
    playerId: player.id,
    playerName: player.name,
    side: 'ask',
    price: safePrice,
    placedAt: now,
  })
  session.asks.sort((a, b) => a.price - b.price || a.placedAt - b.placedAt)
}

function referencePrice(session: AssetBubbleSession): number {
  const lastTrade = session.tradesThisPeriod[session.tradesThisPeriod.length - 1]
  if (lastTrade) return lastTrade.price
  const bestBid = session.bids[0]?.price
  const bestAsk = session.asks[0]?.price
  if (bestBid && bestAsk) return Math.round((bestBid + bestAsk) / 2)
  return getFundamentalValue(session)
}

function forceCounterpartyForHumanOrder(session: AssetBubbleSession, side: OrderSide, humanPrice: number): void {
  const bots = session.players.filter(p => p.isBot)
  if (bots.length === 0) return
  const bot = bots[Math.floor(Math.random() * bots.length)]
  if (!bot) return

  const ref = referencePrice(session)
  if (side === 'bid') {
    if (bot.assets < 1) return
    const askPrice = Math.max(1, Math.min(humanPrice, Math.round(ref * (0.98 + Math.random() * 0.02))))
    upsertOrder(session, bot, 'ask', askPrice)
    return
  }

  if (bot.cash < humanPrice) return
  const bidPrice = Math.max(humanPrice, Math.round(ref * (0.98 + Math.random() * 0.02)))
  upsertOrder(session, bot, 'bid', bidPrice)
}

function maintainBotLiquidity(session: AssetBubbleSession, opts?: { humanSide?: OrderSide; humanPrice?: number }): void {
  if (session.phase !== 'playing') return

  // Shock regime: bots stop buying and only panic sell.
  if (session.shockEvent) {
    const bestBid = session.bids[0]?.price ?? Math.max(1, Math.round(referencePrice(session) * 0.2))
    for (const bot of session.players.filter(p => p.isBot)) {
      session.bids = session.bids.filter(o => o.playerId !== bot.id)
      if (bot.assets > 0) {
        const panicPrice = Math.max(1, Math.round(bestBid * (0.05 + Math.random() * 0.10)))
        upsertOrder(session, bot, 'ask', panicPrice)
      } else {
        session.asks = session.asks.filter(o => o.playerId !== bot.id)
      }
    }
    return
  }

  const fv = getFundamentalValue(session)
  const progress = session.currentPeriod / session.config.totalPeriods
  const base = referencePrice(session)
  const phaseBias = progress <= 0.4 ? 0.10 : progress > 0.6 ? -0.08 : 0
  const flowBias =
    opts?.humanSide === 'bid' ? 0.04 :
      opts?.humanSide === 'ask' ? -0.04 : 0

  for (const bot of session.players.filter(p => p.isBot)) {
    const noise = (Math.random() - 0.5) * 0.04
    const mid = Math.max(1, Math.round((base * 0.6 + fv * 0.4) * (1 + phaseBias + flowBias + noise)))
    const spreadPct = 0.06 + progress * 0.04
    const bidPrice = Math.max(1, Math.round(mid * (1 - spreadPct / 2)))
    const askPrice = Math.max(bidPrice + 1, Math.round(mid * (1 + spreadPct / 2)))

    if (bot.cash >= bidPrice) upsertOrder(session, bot, 'bid', bidPrice)
    else session.bids = session.bids.filter(o => o.playerId !== bot.id)

    if (bot.assets > 0) upsertOrder(session, bot, 'ask', askPrice)
    else session.asks = session.asks.filter(o => o.playerId !== bot.id)
  }

  if (opts?.humanSide && typeof opts.humanPrice === 'number') {
    const bestBid = session.bids[0]?.price
    const bestAsk = session.asks[0]?.price
    const canCross =
      opts.humanSide === 'bid'
        ? Boolean(bestAsk && bestAsk <= opts.humanPrice)
        : Boolean(bestBid && bestBid >= opts.humanPrice)
    if (!canCross) {
      forceCounterpartyForHumanOrder(session, opts.humanSide, opts.humanPrice)
    }
  }
}

export function advanceAssetBubblePeriod(session: AssetBubbleSession): void {
  const { dividend } = session.config
  const fv = getFundamentalValue(session)

  // Pay dividend to all asset holders
  for (const p of session.players) {
    const divPaid = p.assets * dividend
    p.cash += divPaid
  }

  const trades = [...session.tradesThisPeriod]
  const avgPrice = trades.length > 0
    ? Math.round(trades.reduce((s, t) => s + t.price, 0) / trades.length)
    : null

  session.history.push({
    period: session.currentPeriod,
    fundamentalValue: fv,
    trades,
    avgTradePrice: avgPrice,
    dividendPaid: dividend,
  })

  session.eventLog.push(
    `Period ${session.currentPeriod} ended. FV=${fv}. Trades: ${trades.length}. Dividend: ${dividend}/asset.`
  )
  if (session.eventLog.length > 60) session.eventLog.shift()

  // Clear order book between periods
  session.bids = []
  session.asks = []
  session.tradesThisPeriod = []

  if (session.currentPeriod >= session.config.totalPeriods) {
    // Compute final profit vs initial endowment value
    const initialValue = session.config.cashEndowment +
      session.config.assetEndowment * getFundamentalValue(session, 1)
    for (const p of session.players) {
      p.totalProfit = p.cash - initialValue
    }
    session.phase = 'results'
    session.eventLog.push('All periods complete! Game over.')
  } else {
    session.currentPeriod += 1
    session.periodStartedAt = Date.now()
    // Bots: place asks near new fundamental value
    botAction(session)
  }
}

function botAction(session: AssetBubbleSession): void {
  maintainBotLiquidity(session)
}

export const SHOCK_SCENARIOS = [
  { id: 'quantum',  label: 'Quantum Hack',     text: '🚨 BREAKING: A quantum computer has cracked the encryption. All wallets are exposed. The algorithm is broken.' },
  { id: 'founders', label: 'Founders Dumped',  text: '🚨 BREAKING: Project founders sold all their tokens overnight. Developer wallets are now empty.' },
  { id: 'ban',      label: 'Government Ban',   text: '🚨 BREAKING: Government announces immediate trading ban. All exchanges ordered to freeze assets now.' },
  { id: 'hack',     label: 'Exchange Hacked',  text: '🚨 BREAKING: Exchange hacked — $2B stolen. Withdrawals frozen indefinitely.' },
  { id: 'audit',    label: 'No Technology',    text: '🚨 BREAKING: Independent audit reveals there is no actual technology behind this project. It was never real.' },
]

export function triggerShockEvent(session: AssetBubbleSession, scenarioId: string): void {
  const scenario = SHOCK_SCENARIOS.find(s => s.id === scenarioId) ?? SHOCK_SCENARIOS[0]
  session.shockEvent = { scenario: scenario.text, firedAt: Date.now() }

  // Cancel all existing bot bids — they are no longer buying
  session.bids = session.bids.filter(o => {
    const player = session.players.find(p => p.id === o.playerId)
    return !player?.isBot
  })

  // Bots panic-sell at 5–15% of the current best bid (or $1 floor)
  const bestBid = session.bids[0]?.price ?? session.asks[0]?.price ?? 50
  for (const bot of session.players.filter(p => p.isBot)) {
    if (bot.assets > 0) {
      const panicPrice = Math.max(1, Math.round(bestBid * (0.05 + Math.random() * 0.10)))
      placeAsk(session, bot.id, panicPrice)
    }
  }

  session.eventLog.push(`⚡ MINSKY MOMENT: ${scenario.text}`)
  if (session.eventLog.length > 60) session.eventLog.shift()
}

export function startAssetBubbleGame(session: AssetBubbleSession): void {
  session.phase = 'playing'
  session.currentPeriod = 1
  session.periodStartedAt = Date.now()
  const fv = getFundamentalValue(session)
  session.eventLog.push(`Game started! Period 1. Fundamental Value = ${fv}.`)
  if (session.eventLog.length > 60) session.eventLog.shift()
  botAction(session)
}

