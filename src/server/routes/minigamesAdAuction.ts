import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'

const router = Router()
const GAME_SLUG = 'ad-auction'
const GAME_TYPE = MiniGameType.AD_AUCTION
const RUNTIME_KEY = 'adAuctionRuntime'

// ─── Keyword Bank ────────────────────────────────────────────────────────────

type AuctionKeyword = {
  id: string
  keyword: string
  context: string
  clicksAvailable: number
  revenuePerConversion: number
  conversionRate: number  // revealed after bidding
  floorPriceCents: number // minimum price per click (in cents)
}

const KEYWORD_BANK: AuctionKeyword[] = [
  {
    id: 'k01', keyword: 'accounting software NZ',
    context: 'Small business owners searching for cloud accounting tools. High purchase intent.',
    clicksAvailable: 200, revenuePerConversion: 120, conversionRate: 0.04, floorPriceCents: 30,
  },
  {
    id: 'k02', keyword: 'buy running shoes online',
    context: 'Runners comparing footwear brands. Strong transactional intent, competitive market.',
    clicksAvailable: 350, revenuePerConversion: 85, conversionRate: 0.025, floorPriceCents: 20,
  },
  {
    id: 'k03', keyword: 'business insurance quote',
    context: 'Business owners looking for commercial insurance. Very high value per conversion.',
    clicksAvailable: 120, revenuePerConversion: 320, conversionRate: 0.06, floorPriceCents: 80,
  },
  {
    id: 'k04', keyword: 'coffee machine deals',
    context: 'Home baristas hunting for discounts. Price-sensitive, impulse-buy behaviour.',
    clicksAvailable: 480, revenuePerConversion: 45, conversionRate: 0.03, floorPriceCents: 10,
  },
  {
    id: 'k05', keyword: 'web design auckland',
    context: 'Local businesses searching for website development services. High-value B2B leads.',
    clicksAvailable: 90, revenuePerConversion: 850, conversionRate: 0.02, floorPriceCents: 150,
  },
  {
    id: 'k06', keyword: 'mortgage calculator NZ',
    context: 'First home buyers and refinancers. Financial services — strict ad policies, high value.',
    clicksAvailable: 600, revenuePerConversion: 200, conversionRate: 0.015, floorPriceCents: 40,
  },
  {
    id: 'k07', keyword: 'dog grooming near me',
    context: 'Pet owners searching locally. Low search volume, highly localised, loyal customers.',
    clicksAvailable: 80, revenuePerConversion: 35, conversionRate: 0.08, floorPriceCents: 15,
  },
  {
    id: 'k08', keyword: 'electric car lease nz',
    context: 'EV-curious consumers researching lease options. Growing category, moderate competition.',
    clicksAvailable: 150, revenuePerConversion: 400, conversionRate: 0.03, floorPriceCents: 60,
  },
  {
    id: 'k09', keyword: 'online yoga classes',
    context: 'Wellness seekers. High volume, low conversion value. Subscription model applies.',
    clicksAvailable: 420, revenuePerConversion: 18, conversionRate: 0.05, floorPriceCents: 8,
  },
  {
    id: 'k10', keyword: 'commercial cleaning services',
    context: 'Office managers and facilities teams. Contract-based business, recurring revenue.',
    clicksAvailable: 110, revenuePerConversion: 600, conversionRate: 0.025, floorPriceCents: 50,
  },
  {
    id: 'k11', keyword: 'flight deals to bali',
    context: 'Holiday seekers looking for cheap flights. Very competitive, price-driven decisions.',
    clicksAvailable: 900, revenuePerConversion: 55, conversionRate: 0.012, floorPriceCents: 12,
  },
  {
    id: 'k12', keyword: 'HR software small business',
    context: 'SME owners managing people ops. SaaS product — annual subscription value is high.',
    clicksAvailable: 140, revenuePerConversion: 280, conversionRate: 0.04, floorPriceCents: 45,
  },
  {
    id: 'k13', keyword: 'home security systems nz',
    context: 'Homeowners concerned about security. Considered purchase, spouse-involved decision.',
    clicksAvailable: 200, revenuePerConversion: 180, conversionRate: 0.035, floorPriceCents: 35,
  },
  {
    id: 'k14', keyword: 'tutoring auckland',
    context: 'Parents seeking academic support for children. Local, seasonal (exam periods).',
    clicksAvailable: 160, revenuePerConversion: 90, conversionRate: 0.05, floorPriceCents: 18,
  },
  {
    id: 'k15', keyword: 'protein powder nz',
    context: 'Fitness enthusiasts buying supplements. High repeat-purchase rate, brand-loyal.',
    clicksAvailable: 320, revenuePerConversion: 40, conversionRate: 0.045, floorPriceCents: 12,
  },
]

// ─── Runtime Types ───────────────────────────────────────────────────────────

type AuctionPlayer = {
  id: string
  name: string
  budgetCents: number    // remaining budget in cents
  totalProfitCents: number
  hasBidThisRound: boolean
}

type RoundResult = {
  round: number
  keyword: AuctionKeyword
  bids: Record<string, number>         // playerToken → bid in cents per click
  winnerId: string | null
  winnerName: string | null
  pricePaidCents: number               // per click (second price)
  clicks: number
  conversions: number
  winnerRevenueCents: number
  winnerCostCents: number
  winnerProfitCents: number
  breakEvenBidCents: number            // = revenuePerConversion × conversionRate (revealed)
}

type AuctionSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'bidding' | 'results' | 'done'
  currentRound: number                 // 1-indexed
  keywords: AuctionKeyword[]           // selected subset
  players: AuctionPlayer[]
  currentBids: Record<string, number>  // playerToken → bid in cents per click
  history: RoundResult[]
  eventLog: string[]
  config: { rounds: number; startingBudgetCents: number }
  createdAt: number
  lastActivityAt: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): AuctionSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as AuctionSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'done') return MiniGameSessionStatus.COMPLETED
  return MiniGameSessionStatus.ACTIVE
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed >>> 0
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function toPublicSession(rt: AuctionSession, viewerToken?: string) {
  const currentKeyword = rt.keywords[rt.currentRound - 1]
  const isReveal = rt.phase === 'results' || rt.phase === 'done'
  const viewer = rt.players.find(p => p.id === viewerToken)

  return {
    roomCode: rt.roomCode,
    phase: rt.phase,
    currentRound: rt.currentRound,
    config: rt.config,
    players: rt.players.map(p => ({
      id: p.id, name: p.name,
      budgetCents: p.budgetCents,
      totalProfitCents: p.totalProfitCents,
      hasBidThisRound: p.hasBidThisRound,
    })),
    history: rt.history,
    eventLog: rt.eventLog,
    currentKeyword: currentKeyword ? {
      id: currentKeyword.id,
      keyword: currentKeyword.keyword,
      context: currentKeyword.context,
      clicksAvailable: currentKeyword.clicksAvailable,
      revenuePerConversion: currentKeyword.revenuePerConversion,
      // Only reveal conversion rate and break-even after bidding
      conversionRate: isReveal ? currentKeyword.conversionRate : undefined,
      floorPriceCents: currentKeyword.floorPriceCents,
    } : null,
    currentBids: isReveal ? rt.currentBids : undefined,
    stats: { bidsIn: rt.players.filter(p => p.hasBidThisRound).length, total: rt.players.length },
    viewer: viewer ? {
      budgetCents: viewer.budgetCents,
      totalProfitCents: viewer.totalProfitCents,
      hasBid: viewer.hasBidThisRound,
      myBid: isReveal ? rt.currentBids[viewer.id] : undefined,
    } : null,
  }
}

function runAuction(rt: AuctionSession): void {
  const keyword = rt.keywords[rt.currentRound - 1]
  if (!keyword) return

  const bids = rt.currentBids
  const playerBids = rt.players
    .filter(p => bids[p.id] !== undefined)
    .map(p => ({ player: p, bid: bids[p.id] }))
    .sort((a, b) => b.bid - a.bid)

  let winnerId: string | null = null
  let winnerName: string | null = null
  let pricePaidCents = keyword.floorPriceCents
  let clicks = 0
  let conversions = 0
  let winnerRevenueCents = 0
  let winnerCostCents = 0
  let winnerProfitCents = 0

  if (playerBids.length > 0) {
    const winner = playerBids[0]
    const secondBid = playerBids[1]?.bid ?? keyword.floorPriceCents
    // Second-price: winner pays max(second highest bid, floor price)
    pricePaidCents = Math.max(secondBid, keyword.floorPriceCents)

    // Only win if bid >= floor price
    if (winner.bid >= keyword.floorPriceCents) {
      winnerId = winner.player.id
      winnerName = winner.player.name
      clicks = keyword.clicksAvailable
      conversions = Math.round(clicks * keyword.conversionRate)
      winnerRevenueCents = conversions * keyword.revenuePerConversion * 100
      winnerCostCents = clicks * pricePaidCents
      winnerProfitCents = winnerRevenueCents - winnerCostCents

      // Update winner's budget and profit
      winner.player.budgetCents = Math.max(0, winner.player.budgetCents - winnerCostCents)
      winner.player.totalProfitCents += winnerProfitCents
    }
  }

  const breakEvenBidCents = Math.round(keyword.revenuePerConversion * keyword.conversionRate * 100)

  const result: RoundResult = {
    round: rt.currentRound,
    keyword,
    bids: { ...bids },
    winnerId,
    winnerName,
    pricePaidCents,
    clicks,
    conversions,
    winnerRevenueCents,
    winnerCostCents,
    winnerProfitCents,
    breakEvenBidCents,
  }
  rt.history.push(result)

  if (winnerId && winnerName) {
    const profitDisplay = winnerProfitCents >= 0
      ? `+$${(winnerProfitCents / 100).toFixed(2)}`
      : `-$${(Math.abs(winnerProfitCents) / 100).toFixed(2)}`
    rt.eventLog.push(
      `R${rt.currentRound}: ${winnerName} won "${keyword.keyword}" @ $${(pricePaidCents / 100).toFixed(2)}/click → ${conversions} conversions → ${profitDisplay}`
    )
  } else {
    rt.eventLog.push(`R${rt.currentRound}: No valid bids for "${keyword.keyword}".`)
  }
}

async function allocateRoomCode(): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const code = claimUniqueRoomCode()
    const existing = await prisma.miniGameSession.findFirst({ where: { roomCode: code }, select: { id: true } })
    if (!existing) return code
    releaseRoomCode(code)
  }
  throw new Error('Unable to generate unique room code')
}

async function loadSession(roomCode: string) {
  return prisma.miniGameSession.findFirst({
    where: { roomCode: roomCode.toUpperCase(), gameType: GAME_TYPE },
    select: { id: true, hostToken: true, configJson: true, status: true },
  })
}

async function saveRuntime(id: string, rt: AuctionSession) {
  rt.lastActivityAt = Date.now()
  await prisma.miniGameSession.update({
    where: { id },
    data: {
      status: toStatus(rt.phase),
      configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
    },
  })
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// CREATE
router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { rounds?: number; startingBudget?: number }
  const rounds = Math.min(Math.max(Number(body?.rounds) || 6, 3), KEYWORD_BANK.length)
  const startingBudgetCents = Math.round((Number(body?.startingBudget) || 1000) * 100)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const seed = Date.now()
    const keywords = seededShuffle(KEYWORD_BANK, seed).slice(0, rounds)

    const rt: AuctionSession = {
      roomCode, hostToken, phase: 'lobby', currentRound: 1,
      keywords, players: [], currentBids: {}, history: [],
      eventLog: ['Ad Auction created. Waiting for players to join...'],
      config: { rounds, startingBudgetCents },
      createdAt: seed, lastActivityAt: seed,
    }

    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 40,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('AdAuction create error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create game' })
  }
})

router.post(`/${GAME_SLUG}/solo`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })

  const body = req.body as { name?: string; rounds?: number; startingBudget?: number }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  const rounds = Math.min(Math.max(Number(body?.rounds) || 6, 3), KEYWORD_BANK.length)
  const startingBudgetCents = Math.round((Number(body?.startingBudget) || 1000) * 100)
  let roomCode: string | null = null

  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()
    const seed = Date.now()
    const keywords = seededShuffle(KEYWORD_BANK, seed).slice(0, rounds)
    const rt: AuctionSession = {
      roomCode,
      hostToken,
      phase: 'bidding',
      currentRound: 1,
      keywords,
      players: [{
        id: playerToken,
        name,
        budgetCents: startingBudgetCents,
        totalProfitCents: 0,
        hasBidThisRound: false,
      }],
      currentBids: {},
      history: [],
      eventLog: ['Solo test started. Place your first bid.'],
      config: { rounds, startingBudgetCents },
      createdAt: seed,
      lastActivityAt: seed,
    }

    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: GAME_TYPE,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.ACTIVE,
        teamCount: 1,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, playerToken, session: toPublicSession(rt, playerToken) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('AdAuction solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

// JOIN
router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string
        hostToken: string
        configJson: Prisma.JsonValue | null
        status: MiniGameSessionStatus
      }>>(
        `SELECT id, "hostToken", "configJson", status FROM "MiniGameSession" WHERE "roomCode" = $1 FOR UPDATE`,
        roomCode,
      )
      const record = rows[0]
      if (!record) throw new Error('ROOM_NOT_FOUND')
      let rt = asRuntime(record.configJson)
      if (!rt) {
        const _seed = Date.now()
        const _rounds = 6
        const _keywords = seededShuffle(KEYWORD_BANK, _seed).slice(0, _rounds)
        rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, currentRound: 1, keywords: _keywords, players: [], currentBids: {}, history: [], eventLog: ['Game ready. Waiting for players...'], config: { rounds: _rounds, startingBudgetCents: 100000 }, createdAt: _seed, lastActivityAt: _seed }
      }
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 40) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      rt.players.push({
        id: playerToken, name,
        budgetCents: rt.config.startingBudgetCents,
        totalProfitCents: 0,
        hasBidThisRound: false,
      })
      rt.eventLog.push(`${name} joined.`)
      rt.lastActivityAt = Date.now()
      await tx.miniGameSession.update({
        where: { id: record.id },
        data: { status: toStatus(rt.phase), configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue },
      })
      return { playerToken, rt }
    })
    return res.json({ success: true, playerToken: result.playerToken, session: toPublicSession(result.rt, result.playerToken) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'ROOM_NOT_FOUND') return res.status(404).json({ success: false, error: 'Room not found' })
    if (msg === 'GAME_ALREADY_STARTED') return res.status(400).json({ success: false, error: 'Game already started' })
    if (msg === 'ROOM_FULL') return res.status(400).json({ success: false, error: 'Room is full' })
    if (msg === 'NAME_IN_USE') return res.status(400).json({ success: false, error: 'Name already used in this room' })
    console.error('AdAuction join error:', err)
    return res.status(500).json({ success: false, error: 'Failed to join' })
  }
})

// STATE
router.get(`/${GAME_SLUG}/:roomCode/state`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const { playerToken, hostToken } = req.query as Record<string, string>

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })

    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('AdAuction state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

// BID — player submits their CPC bid
router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; bidCents?: number }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'bidding') return res.status(400).json({ success: false, error: 'Not in bidding phase' })

    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    if (player.hasBidThisRound) return res.status(400).json({ success: false, error: 'Already bid this round' })

    const bidCents = Math.max(0, Math.round(Number(body.bidCents) || 0))
    // Cannot bid more than remaining budget
    const maxBid = Math.min(bidCents, player.budgetCents)
    rt.currentBids[player.id] = maxBid
    player.hasBidThisRound = true
    rt.eventLog.push(`${player.name} placed a bid.`)

    // Auto-advance to results if all players bid
    const allBid = rt.players.every(p => p.hasBidThisRound)
    if (allBid) {
      runAuction(rt)
      rt.phase = 'results'
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('AdAuction bid error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit bid' })
  }
})

// START
router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    let rt = asRuntime(record.configJson)
    if (!rt) {
      const _seed = Date.now()
      const _rounds = 6
      const _keywords = seededShuffle(KEYWORD_BANK, _seed).slice(0, _rounds)
      rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, currentRound: 1, keywords: _keywords, players: [], currentBids: {}, history: [], eventLog: ['Game ready. Waiting for players...'], config: { rounds: _rounds, startingBudgetCents: 100000 }, createdAt: _seed, lastActivityAt: _seed }
      await saveRuntime(record.id, rt)
    }
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players' })

    rt.phase = 'bidding'
    rt.currentRound = 1
    rt.currentBids = {}
    rt.players.forEach(p => { p.hasBidThisRound = false })
    rt.eventLog.push(`Game started! Round 1 of ${rt.config.rounds}: "${rt.keywords[0].keyword}"`)

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('AdAuction start error:', err)
    return res.status(500).json({ success: false, error: 'Failed to start' })
  }
})

// ADVANCE — host moves bidding→results or results→next round/done
router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })

    if (rt.phase === 'bidding') {
      // Force reveal even if not all bid
      runAuction(rt)
      rt.phase = 'results'
    } else if (rt.phase === 'results') {
      const next = rt.currentRound + 1
      if (next > rt.config.rounds) {
        rt.phase = 'done'
        const winner = [...rt.players].sort((a, b) => b.totalProfitCents - a.totalProfitCents)[0]
        rt.eventLog.push(`Game over! Winner: ${winner?.name ?? 'No one'} with $${((winner?.totalProfitCents ?? 0) / 100).toFixed(2)} total profit.`)
      } else {
        rt.currentRound = next
        rt.phase = 'bidding'
        rt.currentBids = {}
        rt.players.forEach(p => { p.hasBidThisRound = false })
        rt.eventLog.push(`Round ${next} of ${rt.config.rounds}: "${rt.keywords[next - 1].keyword}"`)
      }
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('AdAuction advance error:', err)
    return res.status(500).json({ success: false, error: 'Failed to advance' })
  }
})

// RESET
router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }

  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })

    const seed = Date.now()
    rt.keywords = seededShuffle(KEYWORD_BANK, seed).slice(0, rt.config.rounds)
    rt.phase = 'lobby'
    rt.currentRound = 1
    rt.currentBids = {}
    rt.players = []
    rt.history = []
    rt.eventLog = ['Game reset. Waiting for players...']

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('AdAuction reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
