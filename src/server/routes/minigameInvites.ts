import { Router } from 'express'
import { MiniGameType } from '@prisma/client'
import { prisma } from '../db'

const router = Router()

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
  | 'capital-structure-lab'
  | 'xero-reconciliation'
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
  CAPITAL_STRUCTURE_LAB: 'capital-structure-lab',
  XERO_RECONCILIATION: 'xero-reconciliation',
  GAME_OF_LIFE: 'game-of-life',
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function isMissingMiniGameTables(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { table?: string; modelName?: string } }
  if (candidate?.code !== 'P2021') return false
  const table = candidate?.meta?.table || ''
  const modelName = candidate?.meta?.modelName || ''
  return table.includes('MiniGameSession') || table.includes('MiniGameInvite') || modelName.includes('MiniGame')
}

router.get('/invite/:joinToken', async (req, res) => {
  try {
    const joinToken = String(req.params.joinToken || '').trim()
    if (!joinToken) {
      return res.status(400).json({ success: false, error: 'Missing invite token' })
    }

    const invite = await prisma.miniGameInvite.findUnique({
      where: { joinToken },
      include: {
        session: true,
      },
    })

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invite not found' })
    }

    const slug = gameTypeToSlug[invite.session.gameType]
    res.json({
      success: true,
      invite: {
        teamLabel: invite.teamLabel,
        gameType: slug,
        title: invite.session.title,
        roomCode: invite.session.roomCode,
      },
    })
  } catch (error) {
    if (isMissingMiniGameTables(error)) {
      return res.status(503).json({
        success: false,
        error: 'Mini-game tables are not deployed yet. Run Prisma migration/db push on this database.',
      })
    }
    console.error('Failed to resolve mini-game invite:', error)
    res.status(500).json({ success: false, error: 'Failed to resolve invite' })
  }
})

router.get('/join/:roomCode', async (req, res) => {
  try {
    const roomCode = String(req.params.roomCode || '').trim().toUpperCase()
    if (!roomCode) {
      return res.status(400).json({ success: false, error: 'Missing room code' })
    }

    const session = await prisma.miniGameSession.findFirst({
      where: {
        roomCode,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        gameType: true,
        title: true,
        roomCode: true,
        status: true,
        teamCount: true,
        configJson: true,
      },
    })

    if (!session) {
      return res.status(404).json({ success: false, error: 'Room code not found' })
    }

    const slug = gameTypeToSlug[session.gameType]
    const configObj = asObject(session.configJson) || {}
    const creditScoreCfg = asObject(configObj.creditScoreConfig)
    return res.json({
      success: true,
      room: {
        roomCode: session.roomCode,
        gameType: slug,
        title: session.title,
        status: session.status,
        teamCount: session.teamCount,
        config: {
          creditScore: creditScoreCfg
            ? {
                difficulty: String(creditScoreCfg.difficulty || 'easy'),
                preset: String(creditScoreCfg.preset || 'student'),
              }
            : null,
        },
      },
    })
  } catch (error) {
    if (isMissingMiniGameTables(error)) {
      return res.status(503).json({
        success: false,
        error: 'Mini-game tables are not deployed yet. Run Prisma migration/db push on this database.',
      })
    }
    console.error('Failed to resolve room code:', error)
    return res.status(500).json({ success: false, error: 'Failed to resolve room code' })
  }
})

export default router
