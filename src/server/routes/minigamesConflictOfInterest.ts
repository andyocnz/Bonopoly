import { Router } from 'express'
import { randomUUID } from 'crypto'
import { MiniGameSessionStatus, MiniGameType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { getSession, getSessionCookie } from '../sessionStore'
import { claimUniqueRoomCode, releaseRoomCode } from '../minigames/roomCodeRegistry'
import type { Request } from 'express'

const router = Router()
const GAME_SLUG = 'conflict-of-interest'
const GAME_TYPE = MiniGameType.CONFLICT_OF_INTEREST
const RUNTIME_KEY = 'coiRuntime'

// ─── Scenario Bank ───────────────────────────────────────────────────────────

type CoiOutcome = {
  legalRiskAction: number
  reputationAction: number
  integrityAction: number
  explanation: string
}

type CoiOption = {
  label: string
  text: string
  outcome: CoiOutcome
}

type CoiScenario = {
  id: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  situation: string
  directorRole: string
  options: CoiOption[]
  correctOptionLabel: string
  principle: string
  reference?: string
}

const SCENARIO_BANK: CoiScenario[] = [
  {
    id: 's01', topic: 'financial-interest', difficulty: 'easy',
    situation: 'Director Aroha owns 15% of a construction company that has submitted a tender for a $2M contract with the organisation she sits on the board of. The board is about to vote on awarding the contract.',
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: 'Declare the interest, leave the room, and abstain from discussion and voting.',
        outcome: { legalRiskAction: -10, reputationAction: 10, integrityAction: 15, explanation: 'Under s140–141 Companies Act 1993, Aroha has a material financial interest. Stepping out is the gold standard for integrity.' }
      },
      {
        label: 'B', text: 'Declare the interest, participate in the discussion, but abstain from voting.',
        outcome: { legalRiskAction: 5, reputationAction: -5, integrityAction: -5, explanation: 'Participating in discussion while holding a material financial interest can still unduly influence the outcome.' }
      },
      {
        label: 'C', text: 'No conflict — owning shares in a supplier is normal and she should vote normally.',
        outcome: { legalRiskAction: 20, reputationAction: -20, integrityAction: -20, explanation: 'A 15% ownership stake is a textbook material financial interest. Voting normally is a serious breach of duty.' }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Directors must not vote on matters in which they have a material financial interest.',
    reference: 'Companies Act 1993, ss140–141',
  },
  {
    id: 's02', topic: 'family-connection', difficulty: 'easy',
    situation: "Director Marcus's spouse is the CEO of a company the board is considering as its new IT systems provider. The contract is worth $500,000 annually.",
    directorRole: 'Executive director',
    options: [
      {
        label: 'A', text: 'Declare the interest and abstain from all deliberation and voting on this item.',
        outcome: { legalRiskAction: -5, reputationAction: 10, integrityAction: 10, explanation: "A spouse's employment relationship creates a personal interest. Full recusal protects the board's integrity." }
      },
      {
        label: 'B', text: 'The spouse relationship is personal, not financial — Marcus can vote if he believes the provider offers best value.',
        outcome: { legalRiskAction: 10, reputationAction: -10, integrityAction: -10, explanation: "Personal relationships that could bias judgement are relevant interests. Materiality applies even without direct financial gain." }
      },
      {
        label: 'C', text: 'Marcus should resign from the board to avoid any appearance of conflict.',
        outcome: { legalRiskAction: 0, reputationAction: -5, integrityAction: 0, explanation: 'Resignation is disproportionate. Proper disclosure and abstention are sufficient to manage the conflict.' }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Interests of close family members can create relevant personal interests for a director.',
    reference: 'Companies Act 1993, s140(2)',
  },
  {
    id: 's03', topic: 'competitor', difficulty: 'easy',
    situation: 'Director Priya sits on the board of Company A. She is also a non-executive director of Company B, a direct competitor. The board of Company A is about to discuss a new pricing strategy.',
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: 'Declare both board positions and abstain from the pricing strategy discussion and vote.',
        outcome: { legalRiskAction: -10, reputationAction: 5, integrityAction: 10, explanation: 'Sitting on a competitor\'s board creates a structural conflict. Priya must step back from competitively sensitive discussions.' }
      },
      {
        label: 'B', text: 'No conflict — Priya is independent on both boards and can keep information confidential.',
        outcome: { legalRiskAction: 15, reputationAction: -10, integrityAction: -10, explanation: 'The structural conflict means she cannot properly fulfil her duties to both simultaneously without disclosure.' }
      },
      {
        label: 'C', text: 'Resign from one of the boards before the meeting.',
        outcome: { legalRiskAction: 0, reputationAction: 0, integrityAction: 5, explanation: 'While a long-term fix, immediate resignation is not required if disclosure and abstention address the immediate issue.' }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Dual board membership in competing firms creates a structural conflict requiring disclosure.',
    reference: 'Companies Act 1993, s131',
  },
  {
    id: 's04', topic: 'no-conflict', difficulty: 'easy',
    situation: "Director Tama is a keen cyclist. The board is considering sponsoring the national cycling federation. Tama has no financial interest in the federation and is not a member.",
    directorRole: 'Independent director',
    options: [
      {
        label: 'A', text: 'Declare his interest in cycling as a hobby and abstain from voting.',
        outcome: { legalRiskAction: 0, reputationAction: 0, integrityAction: -5, explanation: 'Over-disclosing trivial associations can obscure genuine conflicts. A hobby is not a conflict.' }
      },
      {
        label: 'B', text: 'No conflict of interest — Tama may participate fully in discussion and voting.',
        outcome: { legalRiskAction: 0, reputationAction: 5, integrityAction: 5, explanation: "Tama's hobby does not create a material interest. No disclosure required — materiality matters." }
      },
      {
        label: 'C', text: 'Declare the interest but remain in the room and vote as normal.',
        outcome: { legalRiskAction: 0, reputationAction: 0, integrityAction: 0, explanation: 'There is no interest to declare. Doing so wastes board time.' }
      },
    ],
    correctOptionLabel: 'B',
    principle: 'Not every personal connection constitutes a conflict of interest — materiality matters.',
  },
  {
    id: 's05', topic: 'self-dealing', difficulty: 'easy',
    situation: "Director Renata owns a catering company. The board is hiring a firm for a gala. Renata's company has not submitted a tender.",
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: "Declare she owns a catering company and abstain from the vote.",
        outcome: { legalRiskAction: -5, reputationAction: 5, integrityAction: 10, explanation: "Transparency is required even for indirect industry interests. It allows the board to assess materiality." }
      },
      {
        label: 'B', text: "No conflict — her company is not involved, so she can vote freely.",
        outcome: { legalRiskAction: 5, reputationAction: -5, integrityAction: -5, explanation: 'The board should be aware of industry involvement to assess any perceived bias.' }
      },
      {
        label: 'C', text: "Renata should submit her company as a tender and then recuse herself.",
        outcome: { legalRiskAction: 10, reputationAction: -10, integrityAction: -15, explanation: "Using a board position to create a commercial opportunity intensifies the conflict." }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Industry relationships should be disclosed even when the director\'s own entity is not directly involved.',
  },
  {
    id: 's06', topic: 'trust-interest', difficulty: 'medium',
    situation: "Director Chen is a trustee of the Chen Family Trust, which holds 8% of shares in a software vendor. The board is discussing awarding a $1.2M software contract to that vendor.",
    directorRole: 'Chairperson',
    options: [
      {
        label: 'A', text: 'Declare the trust shareholding, step down as chair for this item, and abstain from voting.',
        outcome: { legalRiskAction: -10, reputationAction: 5, integrityAction: 10, explanation: "Interests through a trust are deemed the director's own. Chen must hand over the chair to a deputy." }
      },
      {
        label: 'B', text: 'The trust is a separate legal entity, so Chen has no personal interest and can vote.',
        outcome: { legalRiskAction: 15, reputationAction: -10, integrityAction: -15, explanation: "Trusts do not shield directors from disclosure obligations. This is a clear material interest." }
      },
      {
        label: 'C', text: 'Declare the interest and continue to chair the meeting, but abstain from the final vote only.',
        outcome: { legalRiskAction: 5, reputationAction: -5, integrityAction: -5, explanation: 'Chairing the discussion can unduly shape the outcome. Recusal must include chairing.' }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Interests held through trusts, partnerships or controlled entities are treated as the director\'s own interests.',
    reference: 'Companies Act 1993, s140(2)(c)',
  },
  {
    id: 's07', topic: 'professional-services', difficulty: 'medium',
    situation: "Director Sarah is a partner at a law firm. The organisation needs urgent legal advice on a merger. Sarah offers her firm's services at a 20% discount.",
    directorRole: 'Partner / Board Member',
    options: [
      {
        label: 'A', text: "Declare the interest and have the board seek independent quotes, excluding Sarah's firm from the tender process.",
        outcome: { legalRiskAction: -5, reputationAction: 5, integrityAction: 15, explanation: "Using a board position to funnel business to a professional firm is a conflict. Competitive bidding ensures value." }
      },
      {
        label: 'B', text: "Accept the discount — it's a good deal for the company, and Sarah can recuse herself from the vote.",
        outcome: { legalRiskAction: 10, reputationAction: -5, integrityAction: -5, explanation: "Discounts don't eliminate the conflict. Direct referral without bidding undermines board trust." }
      },
      {
        label: 'C', text: "Sarah should provide the advice for free to avoid any conflict.",
        outcome: { legalRiskAction: 5, reputationAction: 0, integrityAction: 5, explanation: "Even pro-bono advice from a director's firm can create dependency and bias. Formal processes are better." }
      },
    ],
    correctOptionLabel: 'A',
    principle: "Professional directors must ensure their firms do not receive preferential treatment for services.",
  },
  {
    id: 's08', topic: 'financial-interest', difficulty: 'medium',
    situation: "Director Sophia holds 3,000 shares in a publicly listed company. The board is acquiring that company for $45M. The shares represent 0.001% of the listed company.",
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: 'Declare the shareholding for board assessment of materiality.',
        outcome: { legalRiskAction: -5, reputationAction: 5, integrityAction: 5, explanation: 'Even small holdings should be declared so the board can assess materiality collectively.' }
      },
      {
        label: 'B', text: "The shareholding is so small it is immaterial — no disclosure needed.",
        outcome: { legalRiskAction: 10, reputationAction: -5, integrityAction: -5, explanation: "Directors should not self-assess materiality in secret. Disclosure is the correct first step." }
      },
      {
        label: 'C', text: "Sell the shares before the meeting to eliminate the conflict.",
        outcome: { legalRiskAction: 20, reputationAction: -10, integrityAction: -10, explanation: "Selling before an unannounced acquisition could constitute insider trading. Disclosure is required first." }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Disclose and let the board assess materiality — do not self-assess and stay silent.',
    reference: 'Companies Act 1993, s141',
  },
  {
    id: 's09', topic: 'board-interlock', difficulty: 'medium',
    situation: "Director Liam is a nominee director of firm XYZ, which owns 20% of the company. The board is discussing a rights issue that would dilute XYZ's shareholding.",
    directorRole: 'Nominee director (PE firm)',
    options: [
      {
        label: 'A', text: "Declare the tension between duties and XYZ's interests, and seek board guidance.",
        outcome: { legalRiskAction: -5, reputationAction: 5, integrityAction: 10, explanation: "Nominee directors owe duties to the company, not their nominator. Openly discussing the tension is best." }
      },
      {
        label: 'B', text: "Vote to protect XYZ's position — that is why he was nominated.",
        outcome: { legalRiskAction: 15, reputationAction: -10, integrityAction: -15, explanation: "Primary duty is ALWAYS the company. Voting specifically for the nominator is a breach of duty." }
      },
      {
        label: 'C', text: "Abstain from the vote entirely to avoid any appearance of conflict.",
        outcome: { legalRiskAction: 0, reputationAction: 0, integrityAction: 5, explanation: "Nominee directors can participate if they act in the company's best interest. Automatic abstention is not required." }
      },
    ],
    correctOptionLabel: 'A',
    principle: "Nominee directors' primary duty is to the company, not to the party who nominated them.",
    reference: 'Companies Act 1993, s131',
  },
  {
    id: 's15', topic: 'self-dealing', difficulty: 'hard',
    situation: "The board is considering a $200,000 performance bonus for Director Maria (CFO). Maria prepared the financial reports underlying the bonus calculation.",
    directorRole: 'CFO / Executive director',
    options: [
      {
        label: 'A', text: "Declare interest, recuse herself, and have reports independently verified.",
        outcome: { legalRiskAction: -10, reputationAction: 10, integrityAction: 15, explanation: "Maria has a direct interest and prepared the data. Independent verification is crucial here." }
      },
      {
        label: 'B', text: "Maria can present the financial data (as CFO) but must abstain from the vote.",
        outcome: { legalRiskAction: 10, reputationAction: -5, integrityAction: -5, explanation: "Presenting your own bonus data is a massive conflict. An independent source must present it." }
      },
      {
        label: 'C', text: "The bonus was set by formula in advance — no conflict applies.",
        outcome: { legalRiskAction: 15, reputationAction: -10, integrityAction: -10, explanation: "Formulaic bonuses can still be manipulated through the underlying accounting data. Verification is still needed." }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Directors must not participate in decisions about their own remuneration or benefits.',
    reference: 'Companies Act 1993, ss140, 161',
  },
  {
    id: 's10', topic: 'corporate-opportunity', difficulty: 'hard',
    situation: "Director James learns in a board meeting that a prime piece of land is likely to be rezoned. He buys the neighbouring plot through a private company before the news is public.",
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: "Disclose the purchase and current information to the board immediately.",
        outcome: { legalRiskAction: 10, reputationAction: -20, integrityAction: -20, explanation: "While disclosure is needed, the act of using board info for private gain has already occurred. This is a serious breach." }
      },
      {
        label: 'B', text: "No conflict — James bought a different plot from the one the board discussed.",
        outcome: { legalRiskAction: 25, reputationAction: -30, integrityAction: -30, explanation: "Using 'corporate opportunities' or non-public info for private gain violates s145 Companies Act." }
      },
      {
        label: 'C', text: "James should have brought the neighbouring plot opportunity to the board first.",
        outcome: { legalRiskAction: -10, reputationAction: 10, integrityAction: 15, explanation: "Directors must not divert opportunities discovered via their role without full board clearance." }
      },
    ],
    correctOptionLabel: 'C',
    principle: 'Directors must not use information or opportunities obtained in their capacity as a director for personal gain.',
    reference: 'Companies Act 1993, s145',
  },
  {
    id: 's11', topic: 'use-of-information', difficulty: 'hard',
    situation: "Director Elena is an expert in AI. She uses internal board data about the company's proprietary algorithms to write a textbook. She credits the company but keeps the royalties.",
    directorRole: 'Technical director',
    options: [
      {
        label: 'A', text: "Seek explicit board approval and offer to share royalties or license the data.",
        outcome: { legalRiskAction: -5, reputationAction: 5, integrityAction: 10, explanation: "Proprietary data belongs to the company. Negotiating usage rights is the legal path." }
      },
      {
        label: 'B', text: "No conflict — it's Elena's expertise and the book helps the company's reputation.",
        outcome: { legalRiskAction: 15, reputationAction: -10, integrityAction: -10, explanation: "Expertise is her own, but specific data obtained via the board is company property." }
      },
      {
        label: 'C', text: "Publish anonymously to avoid linking it back to the board.",
        outcome: { legalRiskAction: 20, reputationAction: -15, integrityAction: -15, explanation: "Secrecy exacerbates the breach of duty regarding company information." }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Directors are restricted in how they use company information for personal purposes.',
    reference: 'Companies Act 1993, s145',
  },
  {
    id: 's12', topic: 'hospitality', difficulty: 'medium',
    situation: "A major software vendor invites Director Tom to a 3-day 'strategy retreat' in Queenstown, all expenses paid. Tom handles the company's IT procurement.",
    directorRole: 'Executive director',
    options: [
      {
        label: 'A', text: "Decline the invitation to maintain independence and avoid perceived bias.",
        outcome: { legalRiskAction: -5, reputationAction: 10, integrityAction: 15, explanation: "High-value hospitality during procurement creates a strong perception of conflict. Decline is safest." }
      },
      {
        label: 'B', text: "Attend the retreat but pay for his own flights and accommodation.",
        outcome: { legalRiskAction: 0, reputationAction: 5, integrityAction: 5, explanation: "Paying your own way reduces the 'gift' element but the exclusive access still presents a conflict." }
      },
      {
        label: 'C', text: "Attend as an observer and disclose the trip in the interests register.",
        outcome: { legalRiskAction: 10, reputationAction: -10, integrityAction: -5, explanation: "Disclosure helps, but the 'gift' could still be seen as an improper inducement." }
      },
    ],
    correctOptionLabel: 'A',
    principle: 'Directors should exercise caution with hospitality that could influence or be seen to influence their judgement.',
  },
  {
    id: 's18', topic: 'financial-interest', difficulty: 'hard',
    situation: "Director Kim holds options to purchase shares at a fixed price. The board is considering a partnership expected to significantly increase the share price.",
    directorRole: 'Non-executive director',
    options: [
      {
        label: 'A', text: "Declare share options and seeking legal advice on securities law.",
        outcome: { legalRiskAction: -15, reputationAction: 5, integrityAction: 10, explanation: "Share options create a direct financial interest in price-moving decisions. Securities law advice is essential." }
      },
      {
        label: 'B', text: "Options are normal remuneration — no special action needed.",
        outcome: { legalRiskAction: 10, reputationAction: -5, integrityAction: -5, explanation: "Specific relevance to an upcoming announcement MUST be noted. Standing register is not enough." }
      },
      {
        label: 'C', text: "Exercise options before the meeting to eliminate the conflict.",
        outcome: { legalRiskAction: 25, reputationAction: -20, integrityAction: -20, explanation: "Exercising on non-public information is insider trading. This is high legal risk." }
      },
    ],
    correctOptionLabel: 'A',
    principle: "Share options in the company are material interests in decisions affecting share price.",
    reference: 'Financial Markets Conduct Act 2013; Companies Act 1993, s140',
  },
]

const STORYLINE_FRAMES: Array<{ id: string; heading: string; bridge: string }> = [
  {
    id: 's01',
    heading: 'Tender Kickoff',
    bridge: 'Timeline context: Quarter 1. The board launches the Aurora Infrastructure Program and starts procurement.',
  },
  {
    id: 's07',
    heading: 'Adviser Selection',
    bridge: 'Timeline context: Quarter 2. Delivery pressure rises and directors are asked to speed legal/commercial setup.',
  },
  {
    id: 's12',
    heading: 'Vendor Influence',
    bridge: 'Timeline context: Quarter 3. Procurement enters final shortlist, and supplier influence risk increases.',
  },
  {
    id: 's09',
    heading: 'Capital Decision',
    bridge: 'Timeline context: Quarter 4. Funding pressure builds and nominee-director tensions become visible.',
  },
  {
    id: 's15',
    heading: 'Remuneration & Audit',
    bridge: 'Timeline context: Year-end. Audit scrutiny and compensation decisions test the governance trail.',
  },
]

function buildStorylineRounds(): CoiScenario[] {
  const byId = new Map(SCENARIO_BANK.map(s => [s.id, s]))
  return STORYLINE_FRAMES.map((frame, i) => {
    const base = byId.get(frame.id)
    if (!base) throw new Error(`Missing scenario ${frame.id}`)
    return {
      ...base,
      id: `story-${i + 1}-${base.id}`,
      topic: `Round ${i + 1}: ${frame.heading}`,
      situation: `${frame.bridge}\n\n${base.situation}`,
    }
  })
}

// ─── Runtime Types ────────────────────────────────────────────────────────────

type CoiPlayer = {
  id: string
  name: string
  score: number
  hasAnswered: boolean
  roleProfile: RoleProfile
  legalExposure: number
  trustScore: number
  disclosureCompleteness: number
  decisionQuality: number
  teamMorale: number
  deliveryOutcomes: number
  latentRisk: number
}
type CoiHistoryEntry = {
  questionId: string; responses: Record<string, string>
  totalCount: number
  averageLegalExposure: number
  averageTrustScore: number
  averageDisclosure: number
  averageDecisionQuality: number
  averageMorale: number
  averageDelivery: number
  eventCount: number
}
type CoiSession = {
  roomCode: string; hostToken: string
  phase: 'lobby' | 'question' | 'reveal' | 'done'
  currentQuestion: number
  questions: CoiScenario[]
  responses: Record<string, string>
  players: CoiPlayer[]
  history: CoiHistoryEntry[]
  eventLog: string[]
  config: { questionCount: number }
  createdAt: number; lastActivityAt: number
}

type RoleProfile = 'director' | 'executive' | 'procurement'
type GovernanceAction = 'disclose' | 'escalate' | 'recuse' | 'document' | 'proceed'

type GovernanceDelta = {
  legalExposure: number
  trustScore: number
  disclosureCompleteness: number
  decisionQuality: number
  teamMorale: number
  deliveryOutcomes: number
  latentRisk: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireEducatorId(req: Request): string | null {
  const sid = getSessionCookie(req, 'educator')
  const s = getSession(sid)
  if (!s || s.role !== 'educator' || !s.educatorId) return null
  return s.educatorId
}

function asRuntime(configJson: Prisma.JsonValue | null): CoiSession | null {
  if (configJson && typeof configJson === 'object' && !Array.isArray(configJson)) {
    const cfg = configJson as Record<string, unknown>
    if (cfg[RUNTIME_KEY]) return cfg[RUNTIME_KEY] as CoiSession
  }
  return null
}

function toStatus(phase: string): MiniGameSessionStatus {
  if (phase === 'lobby') return MiniGameSessionStatus.LOBBY
  if (phase === 'done') return MiniGameSessionStatus.COMPLETED
  return MiniGameSessionStatus.ACTIVE
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function pickRoleProfile(index: number): RoleProfile {
  const roles: RoleProfile[] = ['director', 'executive', 'procurement']
  return roles[index % roles.length]
}

function createPlayer(id: string, name: string, roleProfile: RoleProfile): CoiPlayer {
  return {
    id,
    name,
    score: 0,
    hasAnswered: false,
    roleProfile,
    legalExposure: 25,
    trustScore: 50,
    disclosureCompleteness: 50,
    decisionQuality: 50,
    teamMorale: 50,
    deliveryOutcomes: 50,
    latentRisk: 0,
  }
}

function normalizePlayers(rt: CoiSession) {
  rt.players = rt.players.map((raw, i) => {
    const base = createPlayer(raw.id, raw.name, pickRoleProfile(i))
    const maybeRole = raw.roleProfile === 'director' || raw.roleProfile === 'executive' || raw.roleProfile === 'procurement'
      ? raw.roleProfile
      : base.roleProfile
    return {
      ...base,
      ...raw,
      roleProfile: maybeRole,
      legalExposure: typeof raw.legalExposure === 'number' ? raw.legalExposure : (typeof (raw as unknown as { legalRisk?: number }).legalRisk === 'number' ? (raw as unknown as { legalRisk: number }).legalRisk : base.legalExposure),
      trustScore: typeof raw.trustScore === 'number' ? raw.trustScore : (typeof (raw as unknown as { reputation?: number }).reputation === 'number' ? (raw as unknown as { reputation: number }).reputation : base.trustScore),
      decisionQuality: typeof raw.decisionQuality === 'number' ? raw.decisionQuality : (typeof (raw as unknown as { integrity?: number }).integrity === 'number' ? (raw as unknown as { integrity: number }).integrity : base.decisionQuality),
      disclosureCompleteness: typeof raw.disclosureCompleteness === 'number' ? raw.disclosureCompleteness : base.disclosureCompleteness,
      teamMorale: typeof raw.teamMorale === 'number' ? raw.teamMorale : base.teamMorale,
      deliveryOutcomes: typeof raw.deliveryOutcomes === 'number' ? raw.deliveryOutcomes : base.deliveryOutcomes,
      latentRisk: typeof raw.latentRisk === 'number' ? raw.latentRisk : base.latentRisk,
    }
  })
}

function evaluateDecision(option: CoiOption, selectedActions: GovernanceAction[]): GovernanceDelta {
  const text = option.text.toLowerCase()
  const mentionsDisclosure = /declare|disclose|register|record/.test(text)
  const mentionsRecusal = /abstain|recuse|leave the room|step down/.test(text)
  const pushesThrough = /vote normally|participate|continue|accept|attend/.test(text)
  const legalExposure = option.outcome.legalRiskAction
  const trustScore = option.outcome.reputationAction
  const decisionQuality = option.outcome.integrityAction
  const disclosureCompleteness =
    (mentionsDisclosure ? 8 : 0) +
    (mentionsRecusal ? 4 : 0) +
    (/no conflict/.test(text) ? -8 : 0)
  const deliveryOutcomes =
    (pushesThrough ? 6 : -2) +
    (mentionsRecusal ? -2 : 0) +
    (legalExposure < 0 ? -1 : 1)
  const teamMorale = Math.round((trustScore + decisionQuality) / 4 + disclosureCompleteness / 3)
  const latentRisk = Math.max(0, legalExposure) + (disclosureCompleteness < 0 ? 6 : 0) - (mentionsDisclosure ? 2 : 0)
  const actions = new Set(selectedActions)
  const pack = { legal: 0, disclosure: 0, quality: 0, trust: 0, morale: 0, delivery: 0, latent: 0 }
  if (actions.has('disclose')) { pack.legal -= 5; pack.disclosure += 8; pack.trust += 3; pack.latent -= 4; pack.delivery -= 1 }
  if (actions.has('escalate')) { pack.legal -= 4; pack.quality += 3; pack.trust += 2; pack.delivery -= 2; pack.latent -= 2 }
  if (actions.has('recuse')) { pack.legal -= 6; pack.quality += 4; pack.trust += 2; pack.delivery -= 3; pack.morale -= 1; pack.latent -= 3 }
  if (actions.has('document')) { pack.legal -= 4; pack.disclosure += 6; pack.quality += 2; pack.delivery -= 1; pack.latent -= 3 }
  if (actions.has('proceed')) { pack.delivery += 5; pack.legal += 5; pack.trust -= 2; pack.disclosure -= 4; pack.latent += 6; pack.morale += 1 }
  if (actions.size === 0) { pack.legal += 6; pack.trust -= 3; pack.disclosure -= 5; pack.quality -= 3; pack.latent += 7 }

  return {
    legalExposure: legalExposure + pack.legal,
    trustScore: trustScore + pack.trust,
    disclosureCompleteness: disclosureCompleteness + pack.disclosure,
    decisionQuality: decisionQuality + pack.quality,
    teamMorale: teamMorale + pack.morale,
    deliveryOutcomes: deliveryOutcomes + pack.delivery,
    latentRisk: latentRisk + pack.latent,
  }
}

function weightedGovernanceScore(player: CoiPlayer): number {
  const legalSafety = 100 - player.legalExposure
  if (player.roleProfile === 'executive') {
    return legalSafety * 0.2 + player.trustScore * 0.18 + player.disclosureCompleteness * 0.15 + player.decisionQuality * 0.17 + player.teamMorale * 0.12 + player.deliveryOutcomes * 0.18
  }
  if (player.roleProfile === 'procurement') {
    return legalSafety * 0.25 + player.trustScore * 0.2 + player.disclosureCompleteness * 0.2 + player.decisionQuality * 0.15 + player.teamMorale * 0.1 + player.deliveryOutcomes * 0.1
  }
  return legalSafety * 0.35 + player.trustScore * 0.2 + player.disclosureCompleteness * 0.2 + player.decisionQuality * 0.2 + player.teamMorale * 0.05
}

function stableRoll(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const n = (h >>> 0) / 4294967295
  return n
}

function applyRoundEvents(rt: CoiSession): number {
  let eventCount = 0
  for (const p of rt.players) {
    const chance = clamp(0.05 + p.latentRisk / 180 + p.legalExposure / 220, 0.05, 0.62)
    const roll = stableRoll(`${rt.createdAt}:${rt.currentQuestion}:${p.id}:${p.latentRisk}:${p.legalExposure}`)
    if (roll < chance) {
      eventCount += 1
      const eventType = roll < chance * 0.4 ? 'audit' : roll < chance * 0.75 ? 'whistleblower' : 'media'
      const legalHit = eventType === 'audit' ? 8 : eventType === 'whistleblower' ? 12 : 10
      const trustHit = eventType === 'media' ? 12 : 8
      p.legalExposure = clamp(p.legalExposure + legalHit, 0, 100)
      p.trustScore = clamp(p.trustScore - trustHit, 0, 100)
      p.teamMorale = clamp(p.teamMorale - 6, 0, 100)
      p.deliveryOutcomes = clamp(p.deliveryOutcomes - 3, 0, 100)
      p.latentRisk = Math.max(0, p.latentRisk - 6)
      p.score -= 4
    }
  }
  if (eventCount > 0) {
    rt.eventLog.push(`Governance shock: ${eventCount} audit/media/whistleblower event(s) triggered this round.`)
  } else {
    rt.eventLog.push('No external governance shock this round.')
  }
  return eventCount
}

function pushRoundHistory(rt: CoiSession, eventCount: number) {
  const total = Math.max(1, rt.players.length)
  const avg = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / total)
  rt.history.push({
    questionId: rt.questions[rt.currentQuestion]?.id ?? `q${rt.currentQuestion + 1}`,
    responses: { ...rt.responses },
    totalCount: rt.players.length,
    averageLegalExposure: avg(rt.players.map(p => p.legalExposure)),
    averageTrustScore: avg(rt.players.map(p => p.trustScore)),
    averageDisclosure: avg(rt.players.map(p => p.disclosureCompleteness)),
    averageDecisionQuality: avg(rt.players.map(p => p.decisionQuality)),
    averageMorale: avg(rt.players.map(p => p.teamMorale)),
    averageDelivery: avg(rt.players.map(p => p.deliveryOutcomes)),
    eventCount,
  })
}

function toPublicSession(rt: CoiSession, viewerToken?: string) {
  normalizePlayers(rt)
  const q = rt.questions[rt.currentQuestion]
  const hideAnswers = rt.phase === 'question'
  const viewer = rt.players.find(p => p.id === viewerToken)
  const parsedResponses = Object.fromEntries(
    Object.entries(rt.responses).map(([pid, value]) => {
      const raw = String(value || '')
      return [pid, raw.split('|')[0] || raw]
    }),
  )
  return {
    roomCode: rt.roomCode, phase: rt.phase,
    currentQuestion: rt.currentQuestion, totalQuestions: rt.questions.length,
    config: rt.config,
    players: rt.players.map(p => ({
      id: p.id, name: p.name, score: p.score, hasAnswered: p.hasAnswered,
      roleProfile: p.roleProfile,
      legalExposure: p.legalExposure,
      trustScore: p.trustScore,
      disclosureCompleteness: p.disclosureCompleteness,
      decisionQuality: p.decisionQuality,
      teamMorale: p.teamMorale,
      deliveryOutcomes: p.deliveryOutcomes,
    })),
    history: rt.history, eventLog: rt.eventLog,
    question: q ? {
      id: q.id, topic: q.topic, difficulty: q.difficulty,
      situation: q.situation, directorRole: q.directorRole,
      principle: hideAnswers ? undefined : q.principle,
      reference: hideAnswers ? undefined : q.reference,
      options: q.options.map(o => ({
        label: o.label, text: o.text,
        outcome: hideAnswers ? undefined : o.outcome,
      })),
    } : null,
    responses: hideAnswers ? undefined : parsedResponses,
    viewer: viewer ? {
      hasAnswered: viewer.hasAnswered,
      myAnswer: parsedResponses[viewer.id] ?? null,
      roleProfile: viewer.roleProfile,
      legalExposure: viewer.legalExposure,
      trustScore: viewer.trustScore,
      disclosureCompleteness: viewer.disclosureCompleteness,
      decisionQuality: viewer.decisionQuality,
      teamMorale: viewer.teamMorale,
      deliveryOutcomes: viewer.deliveryOutcomes,
    } : null,
    stats: { answered: rt.players.filter(p => p.hasAnswered).length, total: rt.players.length },
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

async function saveRuntime(id: string, rt: CoiSession) {
  rt.lastActivityAt = Date.now()
  await prisma.miniGameSession.update({
    where: { id },
    data: {
      status: toStatus(rt.phase),
      configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
    },
  })
}

function defaultSessionRuntime(roomCode: string, hostToken: string): CoiSession {
  const seed = Date.now()
  const questions = buildStorylineRounds()
  return {
    roomCode,
    hostToken,
    phase: 'lobby',
    currentQuestion: 0,
    questions,
    responses: {},
    players: [],
    history: [],
    eventLog: ['Conflict simulation restored. Waiting for players...'],
    config: { questionCount: questions.length },
    createdAt: seed,
    lastActivityAt: seed,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post(`/${GAME_SLUG}/create`, async (req, res) => {
  const educatorId = requireEducatorId(req)
  if (!educatorId) return res.status(401).json({ success: false, error: 'Educator login required' })
  let roomCode: string | null = null
  try {
    roomCode = await allocateRoomCode()
    const hostToken = randomUUID()
    const seed = Date.now()
    const questions = buildStorylineRounds()
    const rt: CoiSession = {
      roomCode, hostToken, phase: 'lobby', currentQuestion: 0,
      questions, responses: {}, players: [], history: [],
      eventLog: ['Conflict of Interest Tribunal created. Waiting for players...'],
      config: { questionCount: questions.length },
      createdAt: seed, lastActivityAt: seed,
    }
    await prisma.miniGameSession.create({
      data: {
        educatorId, gameType: GAME_TYPE, roomCode, hostToken,
        status: MiniGameSessionStatus.LOBBY, teamCount: 60,
        configJson: { [RUNTIME_KEY]: rt } as unknown as Prisma.InputJsonValue,
      },
    })
    return res.json({ success: true, roomCode, hostToken, session: toPublicSession(rt) })
  } catch (err) {
    if (roomCode) releaseRoomCode(roomCode)
    console.error('CoI create error:', err)
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
    const questions = buildStorylineRounds()
    const rt: CoiSession = {
      roomCode,
      hostToken,
      phase: 'question',
      currentQuestion: 0,
      questions,
      responses: {},
      players: [createPlayer(playerToken, name, 'director')],
      history: [],
      eventLog: ['Solo test started.', `Question 1 of ${questions.length}.`],
      config: { questionCount: questions.length },
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
    console.error('CoI solo error:', err)
    return res.status(500).json({ success: false, error: 'Failed to create solo game' })
  }
})

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
        rt = defaultSessionRuntime(roomCode, record.hostToken ?? '')
      }
      normalizePlayers(rt)
      if (rt.phase !== 'lobby') throw new Error('GAME_ALREADY_STARTED')
      if (rt.players.length >= 60) throw new Error('ROOM_FULL')
      if (rt.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('NAME_IN_USE')
      const playerToken = randomUUID()
      rt.players.push(createPlayer(playerToken, name, pickRoleProfile(rt.players.length)))
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
    console.error('CoI join error:', err)
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
    if (!existingRuntime) {
      await saveRuntime(record.id, rt)
    }
    normalizePlayers(rt)
    const isHost = !!hostToken && hostToken === record.hostToken
    const viewerId = rt.players.find(p => p.id === playerToken)?.id
    return res.json({ success: true, session: toPublicSession(rt, viewerId), isHost })
  } catch (err) {
    console.error('CoI state error:', err)
    return res.status(500).json({ success: false, error: 'Failed to get state' })
  }
})

router.post(`/${GAME_SLUG}/:roomCode/action`, async (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase()
  const body = req.body as { playerToken?: string; answer?: string; selectedActions?: GovernanceAction[] }
  try {
    const record = await loadSession(roomCode)
    if (!record) return res.status(404).json({ success: false, error: 'Room not found' })
    const rt = asRuntime(record.configJson)
    if (!rt) return res.status(500).json({ success: false, error: 'Invalid session state' })
    normalizePlayers(rt)
    if (rt.phase !== 'question') return res.status(400).json({ success: false, error: 'Not in question phase' })
    const player = rt.players.find(p => p.id === body.playerToken)
    if (!player) return res.status(403).json({ success: false, error: 'Player not found' })
    if (player.hasAnswered) return res.status(400).json({ success: false, error: 'Already answered' })
    const answer = String(body.answer || '').toUpperCase()
    const allowedActions: GovernanceAction[] = ['disclose', 'escalate', 'recuse', 'document', 'proceed']
    const selectedActions = Array.isArray(body.selectedActions)
      ? body.selectedActions.filter((a): a is GovernanceAction => typeof a === 'string' && allowedActions.includes(a as GovernanceAction))
      : []
    if (selectedActions.length === 0) return res.status(400).json({ success: false, error: 'Select at least one governance action' })
    const q = rt.questions[rt.currentQuestion]
    const chosenOption = q.options.find(o => o.label === answer)
    if (!chosenOption) return res.status(400).json({ success: false, error: 'Invalid answer' })

    rt.responses[player.id] = `${answer}|${selectedActions.join(',')}`
    player.hasAnswered = true

    const beforeScore = weightedGovernanceScore(player)
    const delta = evaluateDecision(chosenOption, selectedActions)
    player.legalExposure = clamp(player.legalExposure + delta.legalExposure, 0, 100)
    player.trustScore = clamp(player.trustScore + delta.trustScore, 0, 100)
    player.disclosureCompleteness = clamp(player.disclosureCompleteness + delta.disclosureCompleteness, 0, 100)
    player.decisionQuality = clamp(player.decisionQuality + delta.decisionQuality, 0, 100)
    player.teamMorale = clamp(player.teamMorale + delta.teamMorale, 0, 100)
    player.deliveryOutcomes = clamp(player.deliveryOutcomes + delta.deliveryOutcomes, 0, 100)
    player.latentRisk = clamp(player.latentRisk + delta.latentRisk, 0, 220)
    const afterScore = weightedGovernanceScore(player)
    player.score += Math.round((afterScore - beforeScore) / 2)

    rt.eventLog.push(`${player.name} made a decision (${selectedActions.join(', ')}).`)
    if (rt.players.every(p => p.hasAnswered)) {
      rt.phase = 'reveal'
      const eventCount = applyRoundEvents(rt)
      pushRoundHistory(rt, eventCount)
      rt.eventLog.push('All decisions made — revealing outcomes.')
    }
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt, player.id) })
  } catch (err) {
    console.error('CoI action error:', err)
    return res.status(500).json({ success: false, error: 'Failed to submit answer' })
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
      const _seed = Date.now()
      const _qs = buildStorylineRounds()
      rt = { roomCode, hostToken: record.hostToken ?? '', phase: 'lobby' as const, currentQuestion: 0, questions: _qs, responses: {}, players: [], history: [], eventLog: ['Game ready. Waiting for players...'], config: { questionCount: _qs.length }, createdAt: _seed, lastActivityAt: _seed }
      await saveRuntime(record.id, rt)
    }
    normalizePlayers(rt)
    if (rt.phase !== 'lobby') return res.status(400).json({ success: false, error: 'Already started' })
    if (rt.players.length < 1) return res.status(400).json({ success: false, error: 'Need at least 1 player' })
    rt.phase = 'question'; rt.currentQuestion = 0; rt.responses = {}
    rt.players.forEach(p => { p.hasAnswered = false })
    rt.eventLog.push(`Game started! Question 1 of ${rt.questions.length}.`)
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('CoI start error:', err)
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
    normalizePlayers(rt)
    if (rt.phase === 'question') {
      const eventCount = applyRoundEvents(rt)
      pushRoundHistory(rt, eventCount)
      rt.phase = 'reveal'
      rt.eventLog.push(`Host revealed outcomes for scenario ${rt.currentQuestion + 1}.`)
    } else if (rt.phase === 'reveal') {
      const next = rt.currentQuestion + 1
      if (next >= rt.questions.length) {
        rt.phase = 'done'; rt.eventLog.push('Game complete!')
      } else {
        rt.currentQuestion = next; rt.phase = 'question'; rt.responses = {}
        rt.players.forEach(p => { p.hasAnswered = false })
        rt.eventLog.push(`Question ${next + 1} of ${rt.questions.length}.`)
      }
    }
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('CoI advance error:', err)
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
    normalizePlayers(rt)
    rt.questions = buildStorylineRounds()
    rt.phase = 'lobby'; rt.currentQuestion = 0; rt.responses = {}
    rt.players = []; rt.history = []
    rt.eventLog = ['Game reset. Waiting for players...']
    await saveRuntime(record.id, rt)
    return res.json({ success: true, session: toPublicSession(rt) })
  } catch (err) {
    console.error('CoI reset error:', err)
    return res.status(500).json({ success: false, error: 'Failed to reset' })
  }
})

export default router
