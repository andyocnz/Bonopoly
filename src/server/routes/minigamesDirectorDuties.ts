import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'

const router = Router()
const GAME_SLUG = 'director-duties'
const GAME_TYPE = MiniGameType.DIRECTOR_DUTIES
const RUNTIME_KEY = 'ddRuntime'

type DDOutcome = {
  legalRiskAction: number
  reputationAction: number
  performanceAction: number
  minutesQualityAction: number
  adviceQualityAction: number
  explanation: string
}

type DDOption = {
  label: string
  text: string
  outcome: DDOutcome
}

type DDMeeting = {
  id: string
  meetingTitle: string
  quarter: string
  situation: string
  difficulty: 'easy' | 'medium' | 'hard'
  options: DDOption[]
}

type DDPlayer = {
  id: string
  name: string
  score: number
  hasAnswered: boolean
  legalRisk: number
  reputation: number
  performance: number
  minutesQuality: number
  adviceQuality: number
}

type DDHistoryEntry = {
  meetingId: string
  responses: Record<string, string>
  totalCount: number
  averageLegalRisk: number
  averageReputation: number
  averagePerformance: number
  averageMinutesQuality: number
  averageAdviceQuality: number
  note: string
}

type DDSession = {
  roomCode: string
  hostToken: string
  phase: 'lobby' | 'question' | 'reveal' | 'done'
  currentQuestion: number
  questions: DDMeeting[]
  responses: Record<string, string>
  players: DDPlayer[]
  history: DDHistoryEntry[]
  eventLog: string[]
  config: { questionCount: number }
  createdAt: number
  lastActivityAt: number
}

type GovernanceAction = 'request-info' | 'record-dissent' | 'seek-advice' | 'recuse-conflicted' | 'defer-conditions'
const ACTION_BUDGET = 2
const GOVERNANCE_ACTIONS: GovernanceAction[] = ['request-info', 'record-dissent', 'seek-advice', 'recuse-conflicted', 'defer-conditions']

function buildBoardStoryline(): DDMeeting[] {
  return [
    {
      id: 'm1',
      meetingTitle: 'Meeting 1 - Cash Warning',
      quarter: 'Q1',
      difficulty: 'easy',
      situation:
        'Management reports cash runway has dropped from 8 months to 4 months. Forecast quality is weak and creditor pressure is rising.',
      options: [
        {
          label: 'A',
          text: 'Approve a rapid expansion campaign to chase revenue before next quarter.',
          outcome: {
            legalRiskAction: 18,
            reputationAction: -8,
            performanceAction: 6,
            minutesQualityAction: -6,
            adviceQualityAction: -4,
            explanation:
              'Short-term revenue may rise, but weak solvency evidence and poor board process increase director exposure.',
          },
        },
        {
          label: 'B',
          text: 'Pause expansion, request weekly cash reporting, and commission independent solvency advice.',
          outcome: {
            legalRiskAction: -10,
            reputationAction: 6,
            performanceAction: -3,
            minutesQualityAction: 8,
            adviceQualityAction: 10,
            explanation:
              'This slows execution but improves duty-of-care process and builds a defensible board record.',
          },
        },
      ],
    },
    {
      id: 'm2',
      meetingTitle: 'Meeting 2 - Related Party Pitch',
      quarter: 'Q1',
      difficulty: 'medium',
      situation:
        'A director suggests awarding a systems contract to a firm where their sibling is a senior executive. Timeline pressure is high.',
      options: [
        {
          label: 'A',
          text: 'Proceed immediately due to urgency and record disclosure later.',
          outcome: {
            legalRiskAction: 20,
            reputationAction: -12,
            performanceAction: 7,
            minutesQualityAction: -10,
            adviceQualityAction: -6,
            explanation:
              'Execution speed improves, but conflict management and governance documentation are inadequate.',
          },
        },
        {
          label: 'B',
          text: 'Declare conflict now, recuse interested director, run a short independent procurement check.',
          outcome: {
            legalRiskAction: -12,
            reputationAction: 8,
            performanceAction: -2,
            minutesQualityAction: 8,
            adviceQualityAction: 6,
            explanation:
              'Slight delay, but conflict controls and procedural fairness reduce long-run governance risk.',
          },
        },
      ],
    },
    {
      id: 'm3',
      meetingTitle: 'Meeting 3 - Debt Covenant Stress',
      quarter: 'Q2',
      difficulty: 'medium',
      situation:
        'Bank warns the next covenant test may fail. CFO requests approval to sign a long-term lease commitment this month.',
      options: [
        {
          label: 'A',
          text: 'Approve the lease to preserve growth narrative for investors.',
          outcome: {
            legalRiskAction: 24,
            reputationAction: -10,
            performanceAction: 5,
            minutesQualityAction: -8,
            adviceQualityAction: -4,
            explanation:
              'Narrative optics improve, but obligation risk rises when solvency is uncertain.',
          },
        },
        {
          label: 'B',
          text: 'Defer lease, run downside scenarios, and renegotiate terms with lenders first.',
          outcome: {
            legalRiskAction: -14,
            reputationAction: 7,
            performanceAction: -1,
            minutesQualityAction: 8,
            adviceQualityAction: 8,
            explanation:
              'Prudent sequencing lowers liability risk and improves evidence for later board decisions.',
          },
        },
      ],
    },
    {
      id: 'm4',
      meetingTitle: 'Meeting 4 - Market Disclosure Pressure',
      quarter: 'Q3',
      difficulty: 'hard',
      situation:
        'A journalist asks about missed targets and director conflicts. Board must decide disclosure posture before market open.',
      options: [
        {
          label: 'A',
          text: 'Release minimal statement to buy time and avoid attention.',
          outcome: {
            legalRiskAction: 14,
            reputationAction: -14,
            performanceAction: 2,
            minutesQualityAction: -6,
            adviceQualityAction: -3,
            explanation:
              'May reduce immediate scrutiny but increases trust and enforcement risk if facts emerge later.',
          },
        },
        {
          label: 'B',
          text: 'Issue candid update with uncertainty ranges and board mitigation actions.',
          outcome: {
            legalRiskAction: -8,
            reputationAction: 10,
            performanceAction: -1,
            minutesQualityAction: 6,
            adviceQualityAction: 5,
            explanation:
              'Transparency can hurt short-term optics but improves credibility and legal defensibility.',
          },
        },
      ],
    },
    {
      id: 'm5',
      meetingTitle: 'Meeting 5 - Restructuring Vote',
      quarter: 'Q4',
      difficulty: 'hard',
      situation:
        'Turnaround team proposes restructuring with layoffs and asset sales. Delay could preserve morale but worsen solvency.',
      options: [
        {
          label: 'A',
          text: 'Delay decision until next quarter to avoid immediate disruption.',
          outcome: {
            legalRiskAction: 16,
            reputationAction: -6,
            performanceAction: -8,
            minutesQualityAction: -4,
            adviceQualityAction: -2,
            explanation:
              'Deferral reduces near-term pain but may breach duty if deterioration is already foreseeable.',
          },
        },
        {
          label: 'B',
          text: 'Approve phased restructuring with creditor communications and oversight checkpoints.',
          outcome: {
            legalRiskAction: -12,
            reputationAction: 5,
            performanceAction: 7,
            minutesQualityAction: 7,
            adviceQualityAction: 6,
            explanation:
              'Difficult action, but controlled implementation and oversight protect company resilience.',
          },
        },
      ],
    },
    {
      id: 'm6',
      meetingTitle: 'Meeting 6 - Retrospective Legal Review',
      quarter: 'Year End',
      difficulty: 'hard',
      situation:
        'External counsel performs a retrospective review of board process, minutes quality, conflicts, and reliance on advice.',
      options: [
        {
          label: 'A',
          text: 'Provide selective records and focus review only on business outcomes.',
          outcome: {
            legalRiskAction: 12,
            reputationAction: -8,
            performanceAction: 0,
            minutesQualityAction: -8,
            adviceQualityAction: -4,
            explanation:
              'Outcome-only defence is weak when process trail is incomplete.',
          },
        },
        {
          label: 'B',
          text: 'Provide full decision trail with rationale, dissent, advice logs, and control changes.',
          outcome: {
            legalRiskAction: -10,
            reputationAction: 8,
            performanceAction: 2,
            minutesQualityAction: 10,
            adviceQualityAction: 8,
            explanation:
              'A complete process record materially improves defensibility under legal and regulator review.',
          },
        },
      ],
    },
  ]
}

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): DDSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as DDSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'done') return MiniGameSessionStatus.COMPLETED
  return MiniGameSessionStatus.ACTIVE
}

function weightedGovernanceScore(player: DDPlayer): number {
  const legalSafety = 100 - player.legalRisk
  return (
    legalSafety * 0.35 +
    player.reputation * 0.2 +
    player.performance * 0.2 +
    player.minutesQuality * 0.15 +
    player.adviceQuality * 0.1
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function stableRoll(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function parseStoredResponse(raw: string): { optionLabel: string; actions: GovernanceAction[] } {
  const [optionPart, actionsPart] = String(raw || '').split('|')
  const actions = String(actionsPart || '')
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is GovernanceAction => GOVERNANCE_ACTIONS.includes(v as GovernanceAction))
  return { optionLabel: String(optionPart || '').toUpperCase(), actions }
}

function actionDelta(actions: GovernanceAction[]): Omit<DDOutcome, 'explanation'> {
  const pack = {
    legalRiskAction: 0,
    reputationAction: 0,
    performanceAction: 0,
    minutesQualityAction: 0,
    adviceQualityAction: 0,
  }
  const selected = new Set(actions)
  if (selected.has('request-info')) {
    pack.legalRiskAction -= 5
    pack.performanceAction -= 2
    pack.minutesQualityAction += 3
    pack.adviceQualityAction += 4
  }
  if (selected.has('record-dissent')) {
    pack.legalRiskAction -= 4
    pack.reputationAction += 2
    pack.minutesQualityAction += 6
  }
  if (selected.has('seek-advice')) {
    pack.legalRiskAction -= 6
    pack.performanceAction -= 2
    pack.adviceQualityAction += 8
    pack.minutesQualityAction += 2
  }
  if (selected.has('recuse-conflicted')) {
    pack.legalRiskAction -= 7
    pack.reputationAction += 3
    pack.performanceAction -= 1
    pack.minutesQualityAction += 3
  }
  if (selected.has('defer-conditions')) {
    pack.legalRiskAction -= 3
    pack.performanceAction -= 4
    pack.minutesQualityAction += 5
    pack.adviceQualityAction += 2
  }
  if (selected.size === 0) {
    pack.legalRiskAction += 6
    pack.minutesQualityAction -= 4
    pack.adviceQualityAction -= 3
  }
  return pack
}

function mergeOutcome(base: DDOutcome, actions: GovernanceAction[]): Omit<DDOutcome, 'explanation'> {
  const extra = actionDelta(actions)
  return {
    legalRiskAction: base.legalRiskAction + extra.legalRiskAction,
    reputationAction: base.reputationAction + extra.reputationAction,
    performanceAction: base.performanceAction + extra.performanceAction,
    minutesQualityAction: base.minutesQualityAction + extra.minutesQualityAction,
    adviceQualityAction: base.adviceQualityAction + extra.adviceQualityAction,
  }
}

function applyDelayedConsequences(rt: DDSession): string {
  let triggered = 0
  for (const p of rt.players) {
    const chance = clamp(0.06 + p.legalRisk / 220 + (60 - p.minutesQuality) / 250 + (55 - p.adviceQuality) / 250, 0.06, 0.68)
    const roll = stableRoll(`${rt.createdAt}:${rt.currentQuestion}:${p.id}:${p.legalRisk}:${p.minutesQuality}:${p.adviceQuality}`)
    if (roll < chance) {
      triggered += 1
      const legalHit = roll < chance * 0.4 ? 8 : 12
      const repHit = roll < chance * 0.65 ? 6 : 10
      p.legalRisk = clamp(p.legalRisk + legalHit, 0, 100)
      p.reputation = clamp(p.reputation - repHit, 0, 100)
      p.performance = clamp(p.performance - 2, 0, 100)
      p.score -= 3
    }
  }
  if (triggered === 0) {
    return 'No delayed legal event triggered this meeting. Governance controls held.'
  }
  if (triggered === 1) {
    return 'One delayed legal/audit event triggered. Weak process from earlier meetings created exposure.'
  }
  return `${triggered} delayed legal/audit events triggered. Prior process quality materially affected outcomes.`
}

function pushRoundHistory(rt: DDSession, note: string) {
  const total = Math.max(1, rt.players.length)
  const average = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / total)
  rt.history.push({
    meetingId: rt.questions[rt.currentQuestion]?.id ?? `m${rt.currentQuestion + 1}`,
    responses: { ...rt.responses },
    totalCount: rt.players.length,
    averageLegalRisk: average(rt.players.map((p) => p.legalRisk)),
    averageReputation: average(rt.players.map((p) => p.reputation)),
    averagePerformance: average(rt.players.map((p) => p.performance)),
    averageMinutesQuality: average(rt.players.map((p) => p.minutesQuality)),
    averageAdviceQuality: average(rt.players.map((p) => p.adviceQuality)),
    note,
  })
}

function toPublicSession(rt: DDSession, viewerToken?: string) {
  const meeting = rt.questions[rt.currentQuestion]
  const hideAnswers = rt.phase === 'question'
  const viewer = rt.players.find((p) => p.id === viewerToken)
  const parsedResponses = Object.fromEntries(
    Object.entries(rt.responses).map(([pid, raw]) => [pid, parseStoredResponse(String(raw)).optionLabel]),
  )
  const viewerParsed = viewer ? parseStoredResponse(rt.responses[viewer.id] ?? '') : null
  return {
    roomCode: rt.roomCode,
    phase: rt.phase,
    currentQuestion: rt.currentQuestion,
    totalQuestions: rt.questions.length,
    config: rt.config,
    players: rt.players.map((p) => ({ id: p.id, name: p.name, score: p.score, hasAnswered: p.hasAnswered })),
    history: rt.history,
    eventLog: rt.eventLog,
    meeting: meeting
      ? {
          id: meeting.id,
          meetingTitle: meeting.meetingTitle,
          quarter: meeting.quarter,
          situation: meeting.situation,
          difficulty: meeting.difficulty,
          options: meeting.options.map((o) => ({
            label: o.label,
            text: o.text,
            outcome: hideAnswers ? undefined : o.outcome,
          })),
        }
      : null,
    responses: hideAnswers ? undefined : parsedResponses,
    viewer: viewer
      ? {
          hasAnswered: viewer.hasAnswered,
          myAnswer: viewerParsed?.optionLabel ?? null,
          myActions: viewerParsed?.actions ?? [],
          legalRisk: viewer.legalRisk,
          reputation: viewer.reputation,
          performance: viewer.performance,
          minutesQuality: viewer.minutesQuality,
          adviceQuality: viewer.adviceQuality,
        }
      : null,
    stats: { answered: rt.players.filter((p) => p.hasAnswered).length, total: rt.players.length },
  }
}

function createPlayer(id: string, name: string): DDPlayer {
  return {
    id,
    name,
    score: 0,
    hasAnswered: false,
    legalRisk: 20,
    reputation: 60,
    performance: 55,
    minutesQuality: 60,
    adviceQuality: 55,
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

async function saveRuntime(id: string, rt: DDSession) {
  rt.lastActivityAt = Date.now()
  await prisma.miniGameSession.update({
    where: { id },
    data: {
      status: toStatus(rt.phase),
      configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
    },
  })
}

function defaultSessionRuntime(roomCode: string, hostToken: string): DDSession {
  const seed = Date.now()
  const meetings = buildBoardStoryline()
  return {
    roomCode,
    hostToken,
    phase: 'lobby',
    currentQuestion: 0,
    questions: meetings,
    responses: {},
    players: [],
    history: [],
    eventLog: ['Board simulation ready. Waiting for players...'],
    config: { questionCount: meetings.length },
    createdAt: seed,
    lastActivityAt: seed,
  }
}

router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const seed = Date.now()
    const meetings = buildBoardStoryline()
    const rt: DDSession = {
      roomCode,
      hostToken,
      phase: 'lobby',
      currentQuestion: 0,
      questions: meetings,
      responses: {},
      players: [],
      history: [],
      eventLog: ['Director Duties board simulation created. Waiting for players...'],
      config: { questionCount: meetings.length },
      createdAt: seed,
      lastActivityAt: seed,
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId,
        gameType: GAME_TYPE,
        roomCode,
        hostToken,
        status: MiniGameSessionStatus.LOBBY,
        teamCount: 60,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('DD create error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create game' })
  }
})

router.post(`/${GAME_SLUG}/solo`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const playerToken = randomUUID()
    const seed = Date.now()
    const meetings = buildBoardStoryline()
    const rt: DDSession = {
      roomCode,
      hostToken,
      phase: 'question',
      currentQuestion: 0,
      questions: meetings,
      responses: {},
      players: [createPlayer(playerToken, name)],
      history: [],
      eventLog: ['Solo board simulation started.', `Meeting 1 of ${meetings.length}.`],
      config: { questionCount: meetings.length },
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
    console.error('DD solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/join`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { name?: string }
  const name = String(body?.name || 'Player').trim().slice(0, 24) || 'Player'
  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string; hostToken: string; configJson: Prisma.JsonValue | null; status: MiniGameSessionStatus }>>(
        `SELECT id, "hostToken", "configJson", status FROM "MiniGameSession" WHERE "roomCode" = $1 FOR UPDATE`,
        roomCode,
      )
      const record = rows[0]
      if (!record) throw new Error('ROOM_NOT_FOUND')
      let rt = asRuntime(record.configJson)
      if (!rt) rt = defaultSessionRuntime(roomCode, record.hostToken ?? '')
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 60) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      rt.players.push(createPlayer(playerToken, name))
      rt.eventLog.push(`${name} joined.`)
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
    console.error('DD join error:', err)
    return res.status(500).json({ success: false, error: 'Failed to join' })
  }
})

router.get(`/${GAME_SLUG}/:roomCode/state`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const { playerToken, hostToken } = req.query as Record<string, string>
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const existingRuntime = asRuntime(record.configJson)
    const rt = existingRuntime ?? defaultSessionRuntime(roomCode, record.hostToken ?? '')
    if (!existingRuntime) await saveRuntime(record.id, rt)
    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find((p) => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('DD state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; optionLabel?: string; selectedActions?: GovernanceAction[] }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    if (rt.phase !== 'question') return res.status(400).json({ success: false, error: 'Not in question phase' })
    const player = rt.players.find((p) => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    if (player.hasAnswered) return res.status(400).json({ success: false, error: 'Already answered' })

    const optionLabel = String(body.optionLabel || '').toUpperCase()
    const meeting = rt.questions[rt.currentQuestion]
    const option = meeting.options.find((o) => o.label === optionLabel)
    if (!option) return res.status(400).json({ success: false, error: 'Invalid option' })
    const selectedActions = Array.isArray(body.selectedActions)
      ? body.selectedActions.filter((a): a is GovernanceAction => GOVERNANCE_ACTIONS.includes(a))
      : []
    const uniqueActions = Array.from(new Set(selectedActions))
    if (uniqueActions.length < 1) return res.status(400).json({ success: false, error: 'Select at least one governance action' })
    if (uniqueActions.length > ACTION_BUDGET) {
      return res.status(400).json({ success: false, error: `You can choose up to ${ACTION_BUDGET} governance actions` })
    }

    rt.responses[player.id] = `${optionLabel}|${uniqueActions.join(',')}`
    player.hasAnswered = true

    const beforeScore = weightedGovernanceScore(player)
    const finalOutcome = mergeOutcome(option.outcome, uniqueActions)
    player.legalRisk = Math.min(100, Math.max(0, player.legalRisk + finalOutcome.legalRiskAction))
    player.reputation = Math.min(100, Math.max(0, player.reputation + finalOutcome.reputationAction))
    player.performance = Math.min(100, Math.max(0, player.performance + finalOutcome.performanceAction))
    player.minutesQuality = Math.min(100, Math.max(0, player.minutesQuality + finalOutcome.minutesQualityAction))
    player.adviceQuality = Math.min(100, Math.max(0, player.adviceQuality + finalOutcome.adviceQualityAction))
    const afterScore = weightedGovernanceScore(player)
    player.score += Math.round((afterScore - beforeScore) / 2)

    rt.eventLog.push(`${player.name} submitted ${optionLabel} with actions: ${uniqueActions.join(', ')}.`)

    if (rt.players.every((p) => p.hasAnswered)) {
      const note = applyDelayedConsequences(rt)
      pushRoundHistory(rt, note)
      rt.phase = 'reveal'
      rt.eventLog.push(note)
      rt.eventLog.push('All decisions made. Revealing board outcomes.')
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('DD action error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit decision' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/start`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    let rt = asRuntime(record.configJson)
    if (!rt) {
      rt = defaultSessionRuntime(roomCode, record.hostToken ?? '')
      await saveRuntime(record.id, rt)
    }
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 1) return res.status(400).json({ success: false, error: 'Need at least 1 player' })
    rt.phase = 'question'
    rt.currentQuestion = 0
    rt.responses = {}
    rt.players.forEach((p) => {
      p.hasAnswered = false
    })
    rt.eventLog.push(`Board timeline started. Meeting 1 of ${rt.questions.length}.`)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('DD start error:', err)
    return res.status(500).json({ success: false, error: 'Failed to start' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/advance`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })

    if (rt.phase === 'question') {
      const note = applyDelayedConsequences(rt)
      pushRoundHistory(rt, note)
      rt.phase = 'reveal'
      rt.eventLog.push(note)
      rt.eventLog.push(`Host revealed outcomes for meeting ${rt.currentQuestion + 1}.`)
    } else if (rt.phase === 'reveal') {
      const next = rt.currentQuestion + 1
      if (next >= rt.questions.length) {
        rt.phase = 'done'
        rt.eventLog.push('Timeline complete. Final governance review ready.')
      } else {
        rt.currentQuestion = next
        rt.phase = 'question'
        rt.responses = {}
        rt.players.forEach((p) => {
          p.hasAnswered = false
        })
        rt.eventLog.push(`Meeting ${next + 1} of ${rt.questions.length}.`)
      }
    }

    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('DD advance error:', err)
    return res.status(500).json({ success: false, error: 'Failed to advance' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/reset`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { hostToken?: string }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    if (body.hostToken !== record.hostToken) return res.status(403).json({ success: false, error: 'Invalid host token' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    rt.questions = buildBoardStoryline()
    rt.phase = 'lobby'
    rt.currentQuestion = 0
    rt.responses = {}
    rt.players = []
    rt.history = []
    rt.eventLog = ['Board simulation reset. Waiting for players...']
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('DD reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
