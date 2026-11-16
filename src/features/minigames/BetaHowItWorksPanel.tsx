import type { MiniGameTypeSlug } from '../../api/client'
import './BetaHowItWorksPanel.css'

type HowContent = {
  title: string
  bullets: string[]
}

const BETA_HOW_CONTENT: Partial<Record<MiniGameTypeSlug, HowContent>> = {
  'prisoners-dilemma': {
    title: 'How This Round Works',
    bullets: [
      'Choose Cooperate or Defect each round without seeing the other side first.',
      'Mutual cooperation gives steady gains; mutual defection hurts both.',
      'Defect can win short-term, but repeated defection reduces total outcomes.',
      'Learning goal: strategic interdependence, trust, and repeated-game incentives.',
    ],
  },
  ultimatum: {
    title: 'How This Round Works',
    bullets: [
      'One player proposes a split, the other accepts or rejects.',
      'If accepted, both get the proposed split; if rejected, both get zero.',
      'Use this to test fairness norms versus purely self-interested logic.',
      'Learning goal: bargaining power, fairness constraints, and credible offers.',
    ],
  },
  'trust-game': {
    title: 'How This Round Works',
    bullets: [
      'Investor sends an amount; it is multiplied before the trustee decides return.',
      'Trustee chooses how much to send back after observing the larger amount.',
      'High trust can create more value, but reciprocity determines final payoffs.',
      'Learning goal: trust, reciprocity, and social preferences in exchange.',
    ],
  },
  'public-goods': {
    title: 'How This Round Works',
    bullets: [
      'Decide how much to keep privately versus contribute to the public pool.',
      'The pool is multiplied, then shared across all players.',
      'Free-riding can be individually attractive but damages group outcomes.',
      'Learning goal: collective action and the free-rider problem.',
    ],
  },
  'adverse-selection': {
    title: 'How This Round Works',
    bullets: [
      'You know your own quality; the buyer only sees average entrant quality.',
      'Decide whether to enter the market this round.',
      'If buyer buys, payoff follows fixed price minus your quality cost.',
      'Learning goal: why private information can unravel a market.',
    ],
  },
  'principal-agent': {
    title: 'How This Round Works',
    bullets: [
      'Contract terms can change each round: fixed wage plus success bonus.',
      'Choose high or low effort before outcome is realized.',
      'High effort raises success chance but has a cost; low effort is cheaper.',
      'Learning goal: incentive design under hidden action (moral hazard).',
    ],
  },
  'matching-pennies': {
    title: 'How This Round Works',
    bullets: [
      'Both players choose heads or tails simultaneously.',
      'One side wins when choices match; the other wins when they differ.',
      'There is no pure dominant strategy across repeated play.',
      'Learning goal: mixed strategies in zero-sum games.',
    ],
  },
  cournot: {
    title: 'How This Round Works',
    bullets: [
      'Each firm chooses quantity at the same time.',
      'Total market quantity determines price via demand.',
      'Output choices trade off market share against price decline.',
      'Learning goal: strategic quantity competition and Nash equilibrium.',
    ],
  },
  bertrand: {
    title: 'How This Round Works',
    bullets: [
      'Each firm sets price simultaneously for similar products.',
      'Lower prices win demand but can compress or eliminate margins.',
      'If prices stay high, rivals can undercut and capture sales.',
      'Learning goal: intense price competition and Bertrand logic.',
    ],
  },
  'english-auction': {
    title: 'How This Round Works',
    bullets: [
      'Each bidder has a private value for the item.',
      'Price increases step-by-step; decide to stay in or drop out.',
      'Last active bidder wins and pays the current price.',
      'Learning goal: bidding discipline and avoiding winner overpayment.',
    ],
  },
  'beauty-contest': {
    title: 'How This Round Works',
    bullets: [
      'Pick a number based on what you think others will choose.',
      'Target is typically a fraction of the average (for example 2/3).',
      'Best replies depend on beliefs about others’ depth of reasoning.',
      'Learning goal: iterative thinking and level-k reasoning.',
    ],
  },
  'monte-carlo-pi': {
    title: 'How This Round Works',
    bullets: [
      'Allocate simulation budget to estimate pi with random sampling.',
      'More trials improve precision but consume limited resources.',
      'Balance accuracy gains against budget and timing constraints.',
      'Learning goal: simulation tradeoffs and estimation uncertainty.',
    ],
  },
  'market-survival': {
    title: 'How This Round Works',
    bullets: [
      'Set choices under uncertainty with drift and volatility risk.',
      'Outcomes vary across paths even with similar starting settings.',
      'Avoid ruin while pursuing the round target.',
      'Learning goal: risk management under stochastic market paths.',
    ],
  },
  'portfolio-frontier': {
    title: 'How This Round Works',
    bullets: [
      'Choose portfolios with different expected return and risk.',
      'Higher return options usually come with higher volatility.',
      'Compare options against your target and risk tolerance.',
      'Learning goal: efficient frontier tradeoffs and allocation discipline.',
    ],
  },
  'signaling-game': {
    title: 'How This Round Works',
    bullets: [
      'Senders choose a signal before receivers act.',
      'Signals can be informative, noisy, or strategically mimicked.',
      'Receiver payoffs depend on how well actions match true type.',
      'Learning goal: separating vs pooling outcomes in information games.',
    ],
  },
  'monopoly-pricing': {
    title: 'How This Round Works',
    bullets: [
      'Set a single price each round as the monopolist.',
      'Higher price increases margin but reduces quantity demanded.',
      'Lower price expands sales volume but can reduce per-unit profit.',
      'Learning goal: profit maximization and deadweight-loss intuition.',
    ],
  },
  'asset-bubble': {
    title: 'How This Round Works',
    bullets: [
      'Trade an asset while market prices may diverge from fundamentals.',
      'Momentum can reward short-term behavior before reversals hit.',
      'Track inventory and cash to avoid being trapped near collapse.',
      'Learning goal: bubble dynamics, speculation, and crash risk.',
    ],
  },
  'conflict-of-interest': {
    title: 'How This Round Works',
    bullets: [
      'Read each governance scenario and identify the conflict risk.',
      'Choose the most defensible action: declare, abstain, recuse, or proceed.',
      'Outcomes depend on duty of loyalty and process quality.',
      'Learning goal: applied conflict governance and board judgment.',
    ],
  },
  'ad-auction': {
    title: 'How This Round Works',
    bullets: [
      'Submit bids for keyword auctions with uncertain conversion outcomes.',
      'Ad rank and pricing depend on bid competition and auction rules.',
      'Overbidding can win traffic but destroy margin.',
      'Learning goal: second-price auction strategy and ROI discipline.',
    ],
  },
  'director-duties': {
    title: 'How This Round Works',
    bullets: [
      'Review each board scenario and classify the duty issue.',
      'Some scenarios have a breach; others are compliant.',
      'Use statutory duties and governance standards, not intuition alone.',
      'Learning goal: applying director-duty rules consistently in practice.',
    ],
  },
}

type Props = {
  gameType: MiniGameTypeSlug
  phase: string
}

export function BetaHowItWorksPanel({ gameType, phase }: Props) {
  const isLivePhase = phase === 'playing' || phase === 'results' || phase === 'bidding' || phase === 'question' || phase === 'reveal' || phase === 'done'
  if (!isLivePhase) return null
  const content = BETA_HOW_CONTENT[gameType]
  if (!content) return null

  return (
    <div className="mg-live-how-panel">
      <h3>{content.title}</h3>
      <ul>
        {content.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </div>
  )
}
