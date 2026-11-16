# Phase 3 — New Mini-Game Simulations

> Research commissioned March 2026. Sources surveyed: Harvard Business Publishing (HBP), MobLab, EconPort, Veconlab, and academic literature on classroom experiments.

---

## Executive Summary

The highest-retention classroom simulations share two traits: **limited information** (students must form and update beliefs) and **feedback delays** (common-sense heuristics fail in instructive ways). The biggest gaps in the current Bonopoly library are Operations, Supply Chain, Marketing, HR, Strategy, Negotiation, Entrepreneurship, and International Business. All top-priority picks can be built as **round-based, stateful-discrete engines** — no continuous real-time state required.

**Already built — do not duplicate:** Bank Run, Prisoner's Dilemma, Ultimatum, Fishery, Trust Game, Public Goods, Adverse Selection, Principal-Agent, Double Auction, English Auction, Ad Auction, Cournot, Bertrand, Monopoly Pricing, Matching Pennies, Beauty Contest, Asset Bubble, Crypto Bubble, Social Influence, Credit Score, Capital Structure Lab, Portfolio Frontier, Assets Diversification, Game of Life, Monte Carlo Pi, Market Basket, A/B Testing, Customer Churn, Conflict of Interest, Director Duties, Xero Reconciliation.

---

## Top 6 Priority Builds ⭐

These have the highest pedagogical impact and are all feasible as round-based web games in a single lecture (10–25 min).

---

### 1. Beer Distribution Game — Bullwhip Factory ⭐

| | |
|---|---|
| **Slug** | `beer-game` |
| **Course fit** | Operations Management · Supply Chain · Systems Thinking |
| **Mode** | Multiplayer (4 roles) or solo vs scripted agents |
| **Difficulty** | Intro-Intermediate |
| **Build complexity** | Round-based, stateful (inventory + backlog carry forward) |

**Decision mechanic:** Each round (week), each student plays one supply-chain role (Retailer → Wholesaler → Distributor → Factory) and chooses an order quantity given on-hand inventory, backorders, and upstream lead-time delays. The engine ships constrained by pipeline stock and returns holding cost + stockout/backorder penalty per week.

**Key insight:** Even with stable end-customer demand, local "reasonable" ordering heuristics amplify upstream oscillations — the bullwhip effect. Students feel this viscerally before being shown the data.

**State per player:** `{ inventory, backlog, incomingPipeline[], cost }`

**Source:** Sterman's Beer Distribution Game; MobLab "Beer Game"; Forio/HBP "Root Beer Game".

---

### 2. Newsvendor Under Pressure ⭐

| | |
|---|---|
| **Slug** | `newsvendor` |
| **Course fit** | Operations · Supply Chain · Retailing · Service Ops |
| **Mode** | Solo (fast) or class leaderboard |
| **Difficulty** | Intro |
| **Build complexity** | Round-based, stateless — easiest possible build |

**Decision mechanic:** Each round, choose order quantity `q` for a perishable item before demand is realised. Demand is drawn from a known distribution. Payoff = revenue − unit cost − leftover/salvage cost − stockout cost. Critical fractile and margin can be varied by treatment group.

**Key insight:** Even when the optimal `q*` is mathematically clear, humans systematically order too close to the mean ("pull-to-centre"). A cornerstone of behavioural operations research.

**Source:** Cachon & Schweitzer (2000) "Decision Bias in the Newsvendor Problem".

---

### 3. Inn or Out — Hotel Yield Management ⭐

| | |
|---|---|
| **Slug** | `yield-management` |
| **Course fit** | Hospitality · Revenue Management · Operations · Pricing |
| **Mode** | Solo or team competition |
| **Difficulty** | Intro-Intermediate |
| **Build complexity** | Round-based, stateful (rooms sold + protection levels) |

**Decision mechanic:** Each round a booking request arrives (arrival date, length of stay, fare, cancellation probability). Student decides accept/reject and optionally sets a protection level for high-fare demand. At "arrival date", stochastic no-shows resolve. Payoff = room revenue − walk/compensation costs − empty-room opportunity cost.

**Key insight:** Revenue management is a control problem under uncertainty — accepting cheap bookings now can block better demand later. Overbooking is rational but risky.

**Source:** *Inn or Out: Yield Management in Hotels* (HBP simulation + teaching note).

---

### 4. Segmented Pricing and Coupon Targeting ⭐

| | |
|---|---|
| **Slug** | `segmented-pricing` |
| **Course fit** | Marketing · Consumer Behaviour · Pricing · Digital Marketing |
| **Mode** | Solo or multiplayer competition |
| **Difficulty** | Intro-Intermediate |
| **Build complexity** | Round-based, lightly stateful (segment reference price memory) |

**Decision mechanic:** Each round, choose (a) list price, (b) a targeted coupon — which segment receives it and at what depth — and (c) budget split across acquisition channels. Hidden segment-level WTP and elasticity determine conversions. Outcomes: profit, market share, customer surplus, and optional fairness/backlash index.

**Key insight:** Price discrimination raises profit but has strategy and trust consequences. Students experience the margin vs volume vs fairness trade-off rather than just reading about it.

**Source:** EconPort Price Discrimination experiment.

---

### 5. Multi-Issue Negotiation — Logrolling Under a Deadline ⭐

| | |
|---|---|
| **Slug** | `negotiation` |
| **Course fit** | Negotiation · HR · Law · Strategy |
| **Mode** | Multiplayer pairs |
| **Difficulty** | Intro-Intermediate |
| **Build complexity** | Round-based, stateful (offer history + shrinking pie/deadline) |

**Decision mechanic:** Two-party negotiation across 2–4 issues (e.g. price, delivery date, exclusivity, service level). Each player has a private score table. Each round, parties submit structured offers (sliders per issue) + accept/reject. The pie shrinks each round or a hard deadline triggers an outside option.

**Key insight:** Integrative deals (logrolling across issues) create joint value above what's available from haggling on price alone. Time pressure and poor information-sharing trap parties in Pareto-inferior outcomes.

**Note:** No free-form chat needed — structured offers keep the engine deterministic and auditable.

**Source:** HBP *Strengthen-U Mud Run* negotiation simulation; MobLab alternating-offer bargaining.

---

### 6. Lean Startup Runway — Experiment, Pivot, or Persevere ⭐

| | |
|---|---|
| **Slug** | `lean-startup` |
| **Course fit** | Entrepreneurship · Innovation · Product Management · Strategy |
| **Mode** | Solo or teams |
| **Difficulty** | Intro-Intermediate |
| **Build complexity** | Round-based, stateful (cash runway + validated learning score) |

**Decision mechanic:** Each round, allocate a limited cash runway across experiments (customer interviews, landing-page tests, MVP build, channel tests). Receive noisy signals (activation rate, retention, WTP proxy). Then choose: **Pivot / Persevere / Kill**. Outcomes: cash remaining, validated learning score, traction metrics.

**Key insight:** Startups are uncertainty-reduction machines. Build–Measure–Learn cycles beat "build it and hope." Students experience the discipline of experimentation under time pressure and scarce resources.

**Source:** Ries, *The Lean Startup*; published classroom exercises applying build–measure–learn.

---

## Full Research Catalogue (20 Games)

### Operations & Supply Chain

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 1 ⭐ | Beer Distribution Game | `beer-game` | Intro-Intermediate | Multiplayer | Stateful |
| 2 ⭐ | Newsvendor Under Pressure | `newsvendor` | Intro | Solo | Stateless ✓ |
| 3 | Staffing the Clinic (Queueing) | `queueing-lab` | Intro-Intermediate | Solo/Multi | Stateful |
| 4 | Disruption Response (Dual Sourcing) | `dual-sourcing` | Intermediate | Solo/Multi | Stateful |
| 5 | Project Trade-offs (Scope–Resources–Schedule) | `project-tradeoffs` | Intro-Intermediate | Solo/Teams | Stateful |

### Hospitality

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 6 ⭐ | Inn or Out: Yield Management | `yield-management` | Intro-Intermediate | Solo/Teams | Stateful |

### Marketing & Strategy

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 7 ⭐ | Segmented Pricing & Coupon Targeting | `segmented-pricing` | Intro-Intermediate | Solo/Multi | Lightly stateful |
| 8 | Conjoint Sprint (Build the Offer) | `conjoint-sprint` | Intro-Intermediate | Multiplayer | Stateless |
| 9 | Go-to-Market Focus | `go-to-market` | Intermediate | Multi/Solo | Stateful |
| 10 | Viral Launch (Seeding & Diffusion) | `viral-launch` | Intro-Intermediate | Solo/Multi | Stateful |
| 11 | Two-Sided Platform Launch | `platform-launch` | Intermediate | Multi/Solo | Stateful |
| 12 | Hold-Up in Outsourcing | `hold-up` | Intermediate | Multiplayer pairs | Stateful (2–3 stages) |

### Negotiation & HR

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 13 ⭐ | Multi-Issue Negotiation | `negotiation` | Intro-Intermediate | Multiplayer pairs | Stateful |
| 14 | Incentive Design Studio | `incentive-design` | Intermediate | Multi/Solo | Stateful |
| 15 | Fair Wage–Effort (Gift Exchange) | `gift-exchange` | Intro-Intermediate | Multiplayer | Stateless |
| 16 | Hiring Funnel Under Uncertainty | `hiring-funnel` | Intermediate | Solo/Teams | Lightly stateful |

### Entrepreneurship & International Business

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 17 ⭐ | Lean Startup Runway | `lean-startup` | Intro-Intermediate | Solo/Teams | Stateful |
| 18 | Tariff Wars | `tariff-wars` | Intermediate | Multiplayer (countries) | Stateless/Stateful |
| 19 | FX Hedging Desk | `fx-hedging` | Intermediate | Solo/Teams | Lightly stateful |

### Healthcare / Market Design

| # | Title | Slug | Difficulty | Mode | Complexity |
|---|---|---|---|---|---|
| 20 | Residency Match Unravelling | `residency-match` | Intro-Intermediate | Multiplayer | Stateful |

---

## Implementation Plan

### Phasing

#### Phase 3A — Quick wins (stateless or near-stateless, highest course demand)
Build these first. Each can be running in a lecture in under 3 weeks.

1. **`newsvendor`** — stateless, single numeric decision, pure solo. Fastest possible build.
2. **`segmented-pricing`** — lightly stateful, clear marketing course demand.
3. **`gift-exchange`** — stateless, small extension of existing wage/effort concepts.

#### Phase 3B — Core simulations (stateful, highest pedagogical impact)
4. **`beer-game`** — flagship operations simulation; needs 4-role multiplayer engine with pipeline state.
5. **`lean-startup`** — stateful cash + learning score; high entrepreneurship course demand.
6. **`negotiation`** — multiplayer pairs with structured offer engine; HR + strategy + law courses.

#### Phase 3C — Specialist additions (niche courses, moderate complexity)
7. **`yield-management`** — hospitality courses; room inventory state.
8. **`conjoint-sprint`** — multiplayer as firms + consumers; marketing research courses.
9. **`tariff-wars`** — multiplayer countries; international business courses.
10. **`hiring-funnel`** — HR analytics / employment law courses.

#### Phase 3D — Advanced builds (high complexity or narrow audience)
11. `incentive-design`, `platform-launch`, `viral-launch`, `go-to-market`, `dual-sourcing`, `queueing-lab`, `project-tradeoffs`, `hold-up`, `fx-hedging`, `residency-match`

---

### Per-game Build Checklist (standard Bonopoly pattern)

For each new game, complete the following in order:

1. `src/data/<game>*.json` — static config (parameters, scenario tables)
2. `src/server/engines/<game>Engine.ts` — pure round logic (stateless function)
3. `src/server/routes/minigames<Game>.ts` — Express routes: `create / join / state / action / start / advance / reset`
4. `prisma/schema.prisma` — add enum value to `MiniGameType`
5. `prisma/migrations/<timestamp>_<name>/migration.sql` — `ALTER TYPE "MiniGameType" ADD VALUE IF NOT EXISTS '...'`
6. Apply migration via direct `$executeRawUnsafe` (do NOT use `prisma migrate dev` — hangs on Supabase pooler)
7. `npx prisma generate`
8. `src/server/minigames/publicRouter.ts` — import + `router.use()`
9. `src/api/client.ts` — add slug to `MiniGameTypeSlug`
10. `src/features/minigames/catalog.ts` — add catalog entry with `topic` + `difficulty` + `solo` fields
11. `src/App.tsx` — lazy import + route under `<MiniGameAccessGate>`
12. `src/pages/<Game>MiniGamePage.tsx` + `.css`
13. `src/features/minigames/MiniGameSvg.tsx` — add inline SVG illustration (120×70 viewBox)
14. `src/data/minigameTeaching.json` — add teaching guide entry

---

### Suggested New Topic Tags

The current `GameTopic` union in `catalog.ts` may need two new values to cover Phase 3 additions:

```ts
// Add to GameTopic union:
| 'Operations'      // beer-game, newsvendor, yield-management, queueing-lab, dual-sourcing, project-tradeoffs
| 'Negotiation'     // negotiation, hold-up
// Existing tags that cover the rest:
// 'Marketing'  → segmented-pricing, conjoint-sprint, go-to-market, viral-launch, platform-launch
// 'Finance'    → fx-hedging
// 'Game Theory' → gift-exchange, incentive-design, tariff-wars, residency-match, hiring-funnel
// 'Behavioural' → lean-startup (pivot/persevere under uncertainty)
```

---

### Build Complexity Reference

| Complexity label | What it means | Example games |
|---|---|---|
| **Stateless** | Each round computed from inputs + RNG only; no carry-over state | Newsvendor, Gift Exchange, Conjoint Sprint |
| **Stateful (discrete)** | Small set of integers carry forward (inventory, cash, installed base) | Beer Game, Lean Startup, Yield Management, Negotiation |
| **Real-time / continuous** | Continuous matching or free-form interaction | *(none in Phase 3 — avoid)* |

**Sweet spot for live lectures:** 3–8 rounds, one numeric/structured decision per round, stochastic realisation or class-wide aggregation, immediate scoreboard + 1–2 debrief charts.

---

*Document generated March 2026. Research by Claude Opus 4.6 via Bonopoly agent.*
