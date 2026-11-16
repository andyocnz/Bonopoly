import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { MiniGameType, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import { getSessionCookie, getSession } from '../sessionStore'
import { claimUniqueRoomCode, claimExistingRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'

const router = Router()

type EducatorRequest = Request & { educatorId?: string }

type MiniGameSlug =
  | 'bank-run'
  | 'fishery'
  | 'double-auction'
  | 'credit-score'
  | 'ultimatum'
  | 'trust-game'
  | 'prisoners-dilemma'
  | 'matching-pennies'
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
  | 'xero-reconciliation'
  | 'capital-structure-lab'
  | 'game-of-life'

const gameTypeToSlug: Record<MiniGameType, MiniGameSlug> = {
  BANK_RUN: 'bank-run',
  FISHERY: 'fishery',
  DOUBLE_AUCTION: 'double-auction',
  CREDIT_SCORE: 'credit-score',
  ULTIMATUM: 'ultimatum',
  TRUST_GAME: 'trust-game',
  PRISONERS_DILEMMA: 'prisoners-dilemma',
  MATCHING_PENNIES: 'matching-pennies',
  PUBLIC_GOODS: 'public-goods',
  COURNOT: 'cournot',
  BERTRAND: 'bertrand',
  ENGLISH_AUCTION: 'english-auction',
  BEAUTY_CONTEST: 'beauty-contest',
  MONTE_CARLO_PI: 'monte-carlo-pi',
  MARKET_SURVIVAL: 'market-survival',
  PORTFOLIO_FRONTIER: 'portfolio-frontier',
  ADVERSE_SELECTION: 'adverse-selection',
  SIGNALING_GAME: 'signaling-game',
  PRINCIPAL_AGENT: 'principal-agent',
  MONOPOLY_PRICING: 'monopoly-pricing',
  ASSET_BUBBLE: 'asset-bubble',
  MARKET_BASKET: 'market-basket',
  AB_TESTING: 'ab-testing',
  CUSTOMER_CHURN: 'customer-churn',
  CONFLICT_OF_INTEREST: 'conflict-of-interest',
  AD_AUCTION: 'ad-auction',
  DIRECTOR_DUTIES: 'director-duties',
  SOCIAL_INFLUENCE: 'social-influence',
  CRYPTO_BUBBLE: 'crypto-bubble',
  XERO_RECONCILIATION: 'xero-reconciliation',
  CAPITAL_STRUCTURE_LAB: 'capital-structure-lab',
  GAME_OF_LIFE: 'game-of-life',
}

const slugToGameType: Record<MiniGameSlug, MiniGameType> = {
  'bank-run': MiniGameType.BANK_RUN,
  fishery: MiniGameType.FISHERY,
  'double-auction': MiniGameType.DOUBLE_AUCTION,
  'credit-score': MiniGameType.CREDIT_SCORE,
  ultimatum: MiniGameType.ULTIMATUM,
  'trust-game': MiniGameType.TRUST_GAME,
  'prisoners-dilemma': MiniGameType.PRISONERS_DILEMMA,
  'matching-pennies': MiniGameType.MATCHING_PENNIES,
  'public-goods': MiniGameType.PUBLIC_GOODS,
  cournot: MiniGameType.COURNOT,
  bertrand: MiniGameType.BERTRAND,
  'english-auction': MiniGameType.ENGLISH_AUCTION,
  'beauty-contest': MiniGameType.BEAUTY_CONTEST,
  'monte-carlo-pi': MiniGameType.MONTE_CARLO_PI,
  'market-survival': MiniGameType.MARKET_SURVIVAL,
  'portfolio-frontier': MiniGameType.PORTFOLIO_FRONTIER,
  'adverse-selection': MiniGameType.ADVERSE_SELECTION,
  'signaling-game': MiniGameType.SIGNALING_GAME,
  'principal-agent': MiniGameType.PRINCIPAL_AGENT,
  'monopoly-pricing': MiniGameType.MONOPOLY_PRICING,
  'asset-bubble': MiniGameType.ASSET_BUBBLE,
  'market-basket': MiniGameType.MARKET_BASKET,
  'ab-testing': MiniGameType.AB_TESTING,
  'customer-churn': MiniGameType.CUSTOMER_CHURN,
  'conflict-of-interest': MiniGameType.CONFLICT_OF_INTEREST,
  'ad-auction': MiniGameType.AD_AUCTION,
  'director-duties': MiniGameType.DIRECTOR_DUTIES,
  'social-influence': MiniGameType.SOCIAL_INFLUENCE,
  'crypto-bubble': MiniGameType.CRYPTO_BUBBLE,
  'xero-reconciliation': MiniGameType.XERO_RECONCILIATION,
  'capital-structure-lab': MiniGameType.CAPITAL_STRUCTURE_LAB,
  'game-of-life': MiniGameType.GAME_OF_LIFE,
}

function isMissingMiniGameTables(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { table?: string; modelName?: string } }
  if (candidate?.code !== 'P2021') return false
  const table = candidate?.meta?.table || ''
  const modelName = candidate?.meta?.modelName || ''
  return table.includes('MiniGameSession') || table.includes('MiniGameInvite') || modelName.includes('MiniGame')
}

function isRoomCodeConflict(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { target?: string[] } }
  if (candidate?.code !== 'P2002') return false
  return Array.isArray(candidate?.meta?.target) && candidate.meta.target.includes('roomCode')
}

function isTransactionStartTimeout(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2028') return false
  const detail = String(error.meta?.error || '')
  return detail.includes('Unable to start a transaction in the given time')
}

const TX_MAX_WAIT_MS = 10_000
const TX_TIMEOUT_MS = 20_000
const TX_RETRY_COUNT = 2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requireEducator(req: EducatorRequest, res: Response, next: NextFunction) {
  const sessionId = getSessionCookie(req, 'educator')
  const session = getSession(sessionId)

  if (!session || session.role !== 'educator' || !session.educatorId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  req.educatorId = session.educatorId
  next()
}

function baseUrl(req: Request): string {
  const configuredFrontendUrl =
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_BASE_URL
  if (configuredFrontendUrl) {
    return configuredFrontendUrl
  }

  const originHeader = req.get('origin')
  if (originHeader) {
    return originHeader
  }

  const proto = req.headers['x-forwarded-proto'] as string | undefined
  const protocol = proto || req.protocol || 'http'
  const host = req.get('host') || 'localhost:5173'
  return `${protocol}://${host}`
}

function buildInvitePlayLink(base: string, slug: MiniGameSlug, inviteToken: string, teamLabel: string, roomCode?: string | null): string {
  const url = new URL(`/mini-games/${slug}`, base)
  url.searchParams.set('invite', inviteToken)
  url.searchParams.set('name', teamLabel)
  if (roomCode) {
    url.searchParams.set('room', roomCode)
  }
  return url.toString()
}

function buildHostPlayLink(base: string, slug: MiniGameSlug, roomCode?: string | null, hostToken?: string | null): string {
  const url = new URL(`/mini-games/${slug}`, base)
  if (roomCode) {
    url.searchParams.set('room', roomCode)
  }
  if (hostToken) {
    url.searchParams.set('hostToken', hostToken)
  }
  return url.toString()
}

function buildJoinByCodeLink(base: string, roomCode?: string | null): string {
  const url = new URL('/mini-games/join', base)
  if (roomCode) {
    url.searchParams.set('code', roomCode)
  }
  return url.toString()
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function extractJoinedCount(configJson: unknown): number {
  // Keep joined count aligned with the same extraction path as player names.
  return extractJoinedPlayers(configJson).filter((p) => !p.isBot).length
}

function extractJoinedPlayers(configJson: unknown): Array<{ id: string; name: string; isBot: boolean; submitted?: boolean }> {
  const cfg = asObject(configJson)
  if (!cfg) return []

  const runtimeKeys = [
    // stable games
    'bankRunRuntime', 'fisheryRuntime', 'auctionRuntime',
    // beta games — players array
    'trustRuntime', 'pdRuntime', 'mpRuntime', 'ultimatumRuntime', 'pgRuntime',
    'sgRuntime', 'asRuntime', 'abRuntime', 'coiRuntime', 'adAuctionRuntime',
    'ddRuntime', 'beautyContestRuntime', 'mcpRuntime', 'msvRuntime',
    'pfRuntime', 'mp2Runtime', 'paRuntime',
    // beta games — firms array (Bertrand, Cournot)
    'bertrandRuntime', 'cournotRuntime',
    // beta games — bidders array (English Auction)
    'englishAuctionRuntime',
    // social influence
    'socialInfluenceRuntime',
    // crypto bubble
    'cryptoBubbleRuntime',
  ]

  for (const key of runtimeKeys) {
    const runtime = asObject(cfg[key])
    if (!runtime) continue

    // support players, firms, or bidders collections
    const collection = Array.isArray(runtime.players) ? runtime.players
      : Array.isArray(runtime.firms) ? runtime.firms
      : Array.isArray(runtime.bidders) ? runtime.bidders
      : null
    if (!collection) continue

    const currentRound = Number(runtime.currentRound || runtime.currentDay || 1)
    const currentRoundKey = String(currentRound)
    const bankActions = asObject(runtime.actionsByDay)?.[currentRoundKey]
    const fisheryActions = asObject(runtime.roundActions)?.[currentRoundKey]
    const auctionOrders = asObject(runtime.roundOrders)?.[currentRoundKey]
    const actionMap = asObject(bankActions) || asObject(fisheryActions) || asObject(auctionOrders)

    return collection
      .map((p) => asObject(p))
      .filter((p): p is Record<string, unknown> => Boolean(p))
      .map((p) => ({
        id: String(p.id || ''),
        name: String(p.name || 'Player'),
        isBot: Boolean(p.isBot),
        submitted: actionMap ? Boolean(actionMap[String(p.id || '')]) : undefined,
      }))
      .filter((p) => p.id.length > 0)
  }
  return []
}

function getInternalApiBase(req: Request): string {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = protoHeader || req.protocol || 'http'
  const host = req.get('host') || 'localhost:3001'
  return `${protocol}://${host}`
}

function getActionPath(gameType: MiniGameType, roomCode: string, action: 'start' | 'advance' | 'reset'): string | null {
  if (gameType === MiniGameType.BANK_RUN) return `/api/minigames/bank-run/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.FISHERY) return `/api/minigames/fishery/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.DOUBLE_AUCTION) return `/api/minigames/double-auction/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.PRISONERS_DILEMMA) return `/api/minigames/prisoners-dilemma/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.MATCHING_PENNIES) return `/api/minigames/matching-pennies/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.ULTIMATUM) return `/api/minigames/ultimatum/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.TRUST_GAME) return `/api/minigames/trust-game/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.PUBLIC_GOODS) return `/api/minigames/public-goods/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.COURNOT) return `/api/minigames/cournot/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.BERTRAND) return `/api/minigames/bertrand/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.ENGLISH_AUCTION) return `/api/minigames/english-auction/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.BEAUTY_CONTEST) return `/api/minigames/beauty-contest/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.MONTE_CARLO_PI) return `/api/minigames/monte-carlo-pi/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.MARKET_SURVIVAL) return `/api/minigames/market-survival/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.PORTFOLIO_FRONTIER) return `/api/minigames/portfolio-frontier/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.ADVERSE_SELECTION) return `/api/minigames/adverse-selection/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.SIGNALING_GAME) return `/api/minigames/signaling-game/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.PRINCIPAL_AGENT) return `/api/minigames/principal-agent/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.MONOPOLY_PRICING) return `/api/minigames/monopoly-pricing/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.ASSET_BUBBLE) return `/api/minigames/asset-bubble/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.CONFLICT_OF_INTEREST) return `/api/minigames/conflict-of-interest/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.AD_AUCTION) return `/api/minigames/ad-auction/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.DIRECTOR_DUTIES) return `/api/minigames/director-duties/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.SOCIAL_INFLUENCE) return `/api/minigames/social-influence/${encodeURIComponent(roomCode)}/${action}`
  if (gameType === MiniGameType.CRYPTO_BUBBLE) return `/api/minigames/crypto-bubble/${encodeURIComponent(roomCode)}/${action}`
  return null
}

type RoomCodeTx = Pick<typeof prisma, 'miniGameSession'>

async function resolveUniqueRoomCode(tx: RoomCodeTx, requestedCode?: string | null): Promise<string> {
  const normalizedRequested = String(requestedCode || '').trim().toUpperCase()
  if (normalizedRequested) {
    const claimed = claimExistingRoomCode(normalizedRequested)
    if (!claimed) {
      throw new Error('Room code already exists. Please try again.')
    }
    const existing = await tx.miniGameSession.findFirst({
      where: { roomCode: normalizedRequested },
      select: { id: true },
    })
    if (existing) {
      releaseRoomCode(normalizedRequested)
      throw new Error('Room code already exists. Please try again.')
    }
    return normalizedRequested
  }

  let attempts = 0
  while (attempts < 200) {
    const generated = claimUniqueRoomCode()
    const existing = await tx.miniGameSession.findFirst({
      where: { roomCode: generated },
      select: { id: true },
    })
    if (!existing) {
      return generated
    }
    releaseRoomCode(generated)
    attempts += 1
  }
  throw new Error('Unable to generate unique room code')
}

router.get('/', requireEducator, async (req: EducatorRequest, res: Response) => {
  try {
    const sessions = await prisma.miniGameSession.findMany({
      where: { educatorId: req.educatorId },
      include: {
        invites: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const origin = baseUrl(req)
    const payload = sessions.map((session) => {
      const slug = gameTypeToSlug[session.gameType]
      return {
        id: session.id,
        gameType: slug,
        title: session.title,
        status: session.status,
        teamCount: session.teamCount,
        joinedCount: extractJoinedCount(session.configJson),
        roomCode: session.roomCode,
        hostToken: session.hostToken,
        createdAt: session.createdAt,
        joinByCodeLink: buildJoinByCodeLink(origin, session.roomCode),
        hostLink: buildHostPlayLink(origin, slug, session.roomCode, session.hostToken),
        invites: session.invites.map((invite) => ({
          id: invite.id,
          teamLabel: invite.teamLabel,
          usedCount: invite.usedCount,
          playLink: buildInvitePlayLink(origin, slug, invite.joinToken, invite.teamLabel, session.roomCode),
        })),
      }
    })

    res.json({ success: true, sessions: payload })
  } catch (error) {
    if (isMissingMiniGameTables(error)) {
      return res.json({ success: true, sessions: [], schemaReady: false })
    }
    console.error('Error listing mini-game sessions:', error)
    res.status(500).json({ success: false, error: 'Failed to list mini-game sessions' })
  }
})

router.post('/', requireEducator, async (req: EducatorRequest, res: Response) => {
  try {
    const body = req.body as {
      gameType?: MiniGameSlug
      title?: string
      teamCount?: number
      configJson?: unknown
      roomCode?: string
      hostToken?: string
    }

    const gameTypeSlug = body.gameType
    if (!gameTypeSlug || !(gameTypeSlug in slugToGameType)) {
      return res.status(400).json({ success: false, error: 'Invalid mini-game type' })
    }

    const teamCount = Math.max(1, Math.min(40, Number(body.teamCount ?? 4)))
    const gameType = slugToGameType[gameTypeSlug]
    let created: { session: Awaited<ReturnType<typeof prisma.miniGameSession.create>>; creditsRemaining: number } | null = null
    let attempt = 0
    while (attempt <= TX_RETRY_COUNT) {
      let claimedRoomCode: string | null = null
      try {
        created = await prisma.$transaction(async (tx) => {
          const educator = await tx.educator.findUnique({
            where: { id: req.educatorId as string },
            select: { credits: true },
          })

          if (!educator) {
            throw new Error('Educator not found')
          }
          if (educator.credits < 1) {
            throw new Error('Insufficient credits. Please contact support to purchase more credits.')
          }

          const updatedEducator = await tx.educator.update({
            where: { id: req.educatorId as string },
            data: { credits: { decrement: 1 } },
            select: { credits: true },
          })

          const roomCode = await resolveUniqueRoomCode(tx, body.roomCode)
          claimedRoomCode = roomCode
          const hostToken = body.hostToken?.trim() || randomUUID()
          const configJson =
            body.configJson === undefined
              ? undefined
              : body.configJson === null
                ? Prisma.JsonNull
                : (body.configJson as Prisma.InputJsonValue)

          const session = await tx.miniGameSession.create({
            data: {
              educatorId: req.educatorId as string,
              gameType,
              title: body.title?.trim() || null,
              teamCount,
              configJson,
              roomCode,
              hostToken,
              invites: {
                create: Array.from({ length: teamCount }).map((_, idx) => ({
                  teamLabel: `Team ${idx + 1}`,
                  joinToken: randomUUID(),
                })),
              },
            },
            include: {
              invites: {
                orderBy: { createdAt: 'asc' },
              },
            },
          })

          return { session, creditsRemaining: updatedEducator.credits }
        }, { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS })
        break
      } catch (error) {
        if (claimedRoomCode) {
          releaseRoomCode(claimedRoomCode)
        }
        if (isTransactionStartTimeout(error) && attempt < TX_RETRY_COUNT) {
          attempt += 1
          await sleep(150 * attempt)
          continue
        }
        throw error
      }
    }

    if (!created) {
      throw new Error('Failed to create mini-game session')
    }

    const session = created.session

    const origin = baseUrl(req)
    const slug = gameTypeToSlug[session.gameType]
    const links = session.invites.map((invite) => ({
      inviteId: invite.id,
      teamLabel: invite.teamLabel,
      playLink: buildInvitePlayLink(origin, slug, invite.joinToken, invite.teamLabel, session.roomCode),
    }))

    res.json({
      success: true,
      session: {
        id: session.id,
        gameType: slug,
        title: session.title,
        status: session.status,
        teamCount: session.teamCount,
        roomCode: session.roomCode,
        hostToken: session.hostToken,
        createdAt: session.createdAt,
        joinByCodeLink: buildJoinByCodeLink(origin, session.roomCode),
        hostLink: buildHostPlayLink(origin, slug, session.roomCode, session.hostToken),
      },
      creditsRemaining: created.creditsRemaining,
      links,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Room code already exists')) {
      return res.status(400).json({ success: false, error: error.message })
    }
    if (isRoomCodeConflict(error)) {
      return res.status(409).json({ success: false, error: 'Room code already exists. Please try again.' })
    }
    if (error instanceof Error && error.message.includes('Insufficient credits')) {
      return res.status(400).json({ success: false, error: error.message })
    }
    if (isMissingMiniGameTables(error)) {
      return res.status(503).json({
        success: false,
        error: 'Mini-game tables are not deployed yet. Run Prisma migration/db push on this database.',
      })
    }
    console.error('Error creating mini-game session:', error)
    res.status(500).json({ success: false, error: 'Failed to create mini-game session' })
  }
})

router.get('/:sessionId/links', requireEducator, async (req: EducatorRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId
    const session = await prisma.miniGameSession.findFirst({
      where: {
        id: sessionId,
        educatorId: req.educatorId,
      },
      include: {
        invites: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      return res.status(404).json({ success: false, error: 'Mini-game session not found' })
    }

    const origin = baseUrl(req)
    const slug = gameTypeToSlug[session.gameType]
    res.json({
      success: true,
      session: {
        id: session.id,
        gameType: slug,
        title: session.title,
        roomCode: session.roomCode,
        hostToken: session.hostToken,
        joinByCodeLink: buildJoinByCodeLink(origin, session.roomCode),
        hostLink: buildHostPlayLink(origin, slug, session.roomCode, session.hostToken),
      },
      links: session.invites.map((invite) => ({
        inviteId: invite.id,
        teamLabel: invite.teamLabel,
        playLink: buildInvitePlayLink(origin, slug, invite.joinToken, invite.teamLabel, session.roomCode),
      })),
    })
  } catch (error) {
    if (isMissingMiniGameTables(error)) {
      return res.status(503).json({
        success: false,
        error: 'Mini-game tables are not deployed yet. Run Prisma migration/db push on this database.',
      })
    }
    console.error('Error loading mini-game links:', error)
    res.status(500).json({ success: false, error: 'Failed to load mini-game links' })
  }
})

router.get('/:sessionId/players', requireEducator, async (req: EducatorRequest, res: Response) => {
  try {
    const session = await prisma.miniGameSession.findFirst({
      where: {
        id: req.params.sessionId,
        educatorId: req.educatorId,
      },
      select: {
        id: true,
        gameType: true,
        status: true,
        teamCount: true,
        configJson: true,
      },
    })

    if (!session) {
      return res.status(404).json({ success: false, error: 'Mini-game session not found' })
    }

    const players = extractJoinedPlayers(session.configJson)
    res.json({
      success: true,
      session: {
        id: session.id,
        gameType: gameTypeToSlug[session.gameType],
        status: session.status,
        teamCount: session.teamCount,
      },
      players,
    })
  } catch (error) {
    console.error('Error loading mini-game players:', error)
    res.status(500).json({ success: false, error: 'Failed to load joined players' })
  }
})

router.post('/:sessionId/host/:action', requireEducator, async (req: EducatorRequest, res: Response) => {
  try {
    const actionRaw = String(req.params.action || '').trim().toLowerCase()
    const action = actionRaw === 'start' || actionRaw === 'advance' || actionRaw === 'reset' ? actionRaw : null
    if (!action) {
      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    const session = await prisma.miniGameSession.findFirst({
      where: {
        id: req.params.sessionId,
        educatorId: req.educatorId,
      },
      select: {
        id: true,
        gameType: true,
        roomCode: true,
        hostToken: true,
      },
    })

    if (!session) {
      return res.status(404).json({ success: false, error: 'Mini-game session not found' })
    }
    if (!session.roomCode || !session.hostToken) {
      return res.status(400).json({ success: false, error: 'Session missing room code or host token' })
    }

    const path = getActionPath(session.gameType, session.roomCode, action)
    if (!path) {
      return res.status(400).json({ success: false, error: 'Host controls not supported for this mini-game type yet' })
    }

    const endpoint = `${getInternalApiBase(req)}${path}`
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken: session.hostToken }),
    })

    const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>
    if (!upstream.ok || payload.success === false) {
      return res.status(upstream.status || 400).json({
        success: false,
        error: String(payload.error || 'Host action failed'),
      })
    }

    return res.json({
      success: true,
      action,
      sessionId: session.id,
      gameType: gameTypeToSlug[session.gameType],
      state: payload.session ?? null,
    })
  } catch (error) {
    console.error('Error performing mini-game host action:', error)
    res.status(500).json({ success: false, error: 'Failed to perform host action' })
  }
})

export default router
