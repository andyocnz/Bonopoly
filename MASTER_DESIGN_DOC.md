# 🎯 BONOPOLY 2026 - MASTER DESIGN DOCUMENT

**VERSION**: 1.0
**LAST UPDATED**: 2024-12-13
**STATUS**: Design Phase - Ready for Implementation

⚠️ **THIS IS THE SINGLE SOURCE OF TRUTH - ALL OTHER .md FILES ARE DRAFTS/RESEARCH**

---

## 📋 TABLE OF CONTENTS

1. [Project Vision & Goals](#project-vision--goals)
2. [Product-Agnostic Design](#product-agnostic-design)
3. [Critical Systems to Review & Improve](#critical-systems-to-review--improve)
4. [Google Sheets Database Structure](#google-sheets-database-structure)
5. [Workflow & Business Logic](#workflow--business-logic)
6. [Improved Demand System](#improved-demand-system)
7. [Implementation Phases](#implementation-phases)
8. [File Management & Handoff Protocol](#file-management--handoff-protocol)

---

## 1. PROJECT VISION & GOALS

### Vision
**Bonopoly 2026**: A modern, product-agnostic business simulation game that teaches university students real-world strategy through competitive gameplay.

### Core Principles
1. ✅ **Product-Agnostic**: Not just phones - should work for cars, electronics, any manufactured product
2. ✅ **Realistic Economics**: Challenge and improve original formulas (don't just copy)
3. ✅ **Educational First**: Every mechanic must teach real business concepts
4. ✅ **Simple to Configure**: Educators can switch products easily
5. ✅ **Full Automation**: Zero manual work after game creation

### 2026 Release Goals
- **Phase 1 (2024 Q4)**: Working React prototype with phones
- **Phase 2 (2025 Q1)**: Product configuration system
- **Phase 3 (2025 Q2-Q3)**: Beta testing with universities
- **Phase 4 (2025 Q4)**: Refinement based on feedback
- **Release (2026 Q1)**: Bonopoly 2026 official launch

---

## 2. PRODUCT-AGNOSTIC DESIGN

### Current Problem
Original system is **hardcoded for phones**:
- Technology = "Phone with features"
- Suppliers tied to phone components
- Market dynamics assume phone market

### Proposed Solution: Product Configuration Layer

```typescript
interface ProductConfig {
  // Basic Product Info
  productType: 'phone' | 'car' | 'laptop' | 'appliance' | 'custom'
  productName: string  // e.g., "Smartphone", "Electric Vehicle"
  unitName: string     // e.g., "phone", "vehicle", "unit"

  // Technology Levels (Generic)
  technologies: TechnologyLevel[]

  // Suppliers (Generic)
  suppliers: SupplierOption[]

  // Features (Configurable)
  features: FeatureDefinition[]

  // Market Characteristics
  marketCharacteristics: MarketProfile
}

// Example 1: Phones (Default)
const PHONE_CONFIG: ProductConfig = {
  productType: 'phone',
  productName: 'Smartphone',
  unitName: 'phone',

  technologies: [
    { id: 'tech1', name: '3G Phone', description: 'Basic phone, voice + SMS' },
    { id: 'tech2', name: '4G Smartphone', description: 'Apps, internet, camera' },
    { id: 'tech3', name: '5G Premium', description: 'High-end features, AI' },
    { id: 'tech4', name: '6G Flagship', description: 'Cutting edge, foldable' }
  ],

  suppliers: [
    { id: 1, name: 'Budget Components Ltd', costMultiplier: 0.8, csrRating: 3 },
    { id: 2, name: 'Standard Electronics Co', costMultiplier: 1.0, csrRating: 5 },
    { id: 3, name: 'Ethical Sourcing Inc', costMultiplier: 1.15, csrRating: 9 },
    { id: 4, name: 'Premium Parts Ltd', costMultiplier: 1.3, csrRating: 6 }
  ],

  features: [
    { id: 'camera', name: 'Camera Quality', costPerLevel: 50 },
    { id: 'battery', name: 'Battery Life', costPerLevel: 30 },
    { id: 'screen', name: 'Screen Size/Quality', costPerLevel: 40 },
    { id: 'storage', name: 'Storage Capacity', costPerLevel: 20 },
    { id: 'ai', name: 'AI Features', costPerLevel: 100 }
  ],

  marketCharacteristics: {
    demandElasticity: 1.2,
    averagePrice: 800,
    replacementCycle: 2.5  // years
  }
}

// Example 2: Electric Vehicles (Future)
const EV_CONFIG: ProductConfig = {
  productType: 'car',
  productName: 'Electric Vehicle',
  unitName: 'vehicle',

  technologies: [
    { id: 'tech1', name: 'Hybrid Electric', description: 'Gas + Electric' },
    { id: 'tech2', name: 'Full Electric (200mi)', description: 'Basic EV' },
    { id: 'tech3', name: 'Long Range (400mi)', description: 'Extended battery' },
    { id: 'tech4', name: 'Autonomous EV', description: 'Self-driving' }
  ],

  suppliers: [
    { id: 1, name: 'Cheap Battery Co', costMultiplier: 0.85, csrRating: 2 },
    { id: 2, name: 'Standard Motors Parts', costMultiplier: 1.0, csrRating: 5 },
    { id: 3, name: 'Green Battery Alliance', costMultiplier: 1.2, csrRating: 10 },
    { id: 4, name: 'Premium EV Components', costMultiplier: 1.4, csrRating: 7 }
  ],

  features: [
    { id: 'range', name: 'Battery Range', costPerLevel: 5000 },
    { id: 'charging', name: 'Fast Charging', costPerLevel: 2000 },
    { id: 'autopilot', name: 'Autopilot Level', costPerLevel: 8000 },
    { id: 'interior', name: 'Interior Quality', costPerLevel: 3000 },
    { id: 'performance', name: 'Acceleration', costPerLevel: 4000 }
  ],

  marketCharacteristics: {
    demandElasticity: 0.8,
    averagePrice: 45000,
    replacementCycle: 8  // years
  }
}
```

### Implementation Strategy
**For Prototype (2024-2025)**:
- Hardcode phones (faster development)
- Design data structures to be product-agnostic
- Use `ProductConfig` interface throughout codebase
- All calculations reference `productConfig` not hardcoded "phone"

**For Full System (2025)**:
- Add product configuration UI
- Allow educators to choose product type
- Store `product_config_json` in Games sheet
- All game logic reads from config

---

## 3. CRITICAL SYSTEMS TO REVIEW & IMPROVE

### ✅ **COMPLETED: See IMPROVED_GAME_FORMULAS.md**

**All critical formulas have been redesigned and documented in:**
📄 **[IMPROVED_GAME_FORMULAS.md](IMPROVED_GAME_FORMULAS.md)**

This document includes:
1. ✅ **New Cost Equation System** - Separated fixed/variable costs with realistic utilization curves
2. ✅ **New Market Demand System** - Fixed market sizes independent of team capacity
3. ✅ **New Market Share Algorithm** - Competitive attractiveness-based distribution
4. ✅ **New Scenario System** - 8 realistic economic scenarios with differentiated impacts
5. ✅ **Database Schema Changes** - All new parameters and tables documented
6. ✅ **Implementation Checklist** - Complete migration plan

### ⚠️ Systems That Need Deep Review (Don't Just Copy!)

#### 3.1 Cost Equation 🔍 **✅ REDESIGNED - See IMPROVED_GAME_FORMULAS.md Section 2**

**Original Formula** (game.php line ~608):
```php
Cost = (1 + Promotion) × [a × capacity^b + c × capacity + d]
```

**Parameters**: `a=0.9, b=6, c=-0.85, d=1.5`

**Questions to Answer**:
1. ❓ Why `capacity^6`? That's an EXTREME exponent!
   - For capacity = 1000 units → 1000^6 = 10^18 (insane!)
   - This must be wrong or capacity is in different units?
   - **TODO**: Verify actual numbers from sample game

2. ❓ What does this formula actually represent?
   - Economies of scale? (should be cost DECREASING with volume)
   - Learning curve? (should compound over time)
   - Fixed vs variable costs? (seems to mix both)

3. ❓ Is there a better cost model?
   - **Option A**: Separate fixed and variable costs
     ```typescript
     totalCost = fixedCost + (variableCostPerUnit × quantity)
     fixedCost = plantCost + adminCost + depreciation
     variableCostPerUnit = materialCost + labourCost + energyCost
     ```
   - **Option B**: Learning curve model
     ```typescript
     cumulativeUnits = previousProduction + currentProduction
     learningRate = 0.90  // 90% learning curve
     costReduction = (cumulativeUnits / firstUnitCost) ^ log(learningRate)/log(2)
     currentUnitCost = baseUnitCost × costReduction
     ```
   - **Option C**: Economies of scale (textbook model)
     ```typescript
     averageCost = fixedCost/quantity + variableUnitCost
     // As quantity ↑, average cost ↓ (spreading fixed costs)
     ```

**Status**: ✅ **REDESIGNED**
- [x] Analyzed original formula behavior
- [x] Understood economic meaning (capacity utilization efficiency)
- [x] Proposed improved formula (separated fixed/variable costs)
- [x] Documented in IMPROVED_GAME_FORMULAS.md Section 2

**New System Features**:
- Transparent cost breakdown (students see fixed vs variable)
- Technology-specific efficiency multipliers
- Realistic utilization curve (optimal at 80%, not 50%)
- Configurable parameters (no hardcoded magic numbers)

---

#### 3.2 Market Share Distribution 🔍 **✅ REDESIGNED - See IMPROVED_GAME_FORMULAS.md Section 4**

**Current System** (not fully understood from PHP):
- Teams compete based on: price, features, promotion, tech, CSR
- Market share calculated somehow
- Need to find the actual algorithm

**Questions**:
1. ❓ How is attractiveness score calculated?
2. ❓ Is it winner-take-all or proportional distribution?
3. ❓ Does previous market share matter (brand loyalty)?
4. ❓ What if total capacity < total demand? (shortage)
5. ❓ What if total capacity > total demand? (overcapacity)

**Proposed Improved System**:
```typescript
function calculateMarketShare(teams, marketDemand, consumerPreferences) {
  // Step 1: Calculate attractiveness for each team
  const scores = teams.map(team => {
    // Quality score (features + tech level)
    const qualityScore =
      (team.features × 0.3) +
      (team.technology.attractiveness × 0.5) +
      (team.brandReputation × 0.2)

    // Price competitiveness (lower price = higher score)
    const avgMarketPrice = teams.reduce((sum, t) => sum + t.price, 0) / teams.length
    const priceScore = avgMarketPrice / team.price  // Inverse relationship

    // Promotion impact
    const promotionMultiplier = 1 + (team.promotionSpend / 100)

    // CSR bonus (from scenario consumer preferences)
    const csrMultiplier = team.supplier.csrRating > 7 ? 1.15 : 1.0

    // Weighted attractiveness (scenario-dependent)
    const attractiveness =
      (qualityScore × consumerPreferences.qualityWeight) ×
      (priceScore × consumerPreferences.priceWeight) ×
      promotionMultiplier ×
      csrMultiplier

    return {
      teamId: team.id,
      attractiveness,
      capacity: team.productionCapacity,
      price: team.price
    }
  })

  // Step 2: Calculate ideal demand share (proportional to attractiveness)
  const totalAttractiveness = scores.reduce((sum, s) => sum + s.attractiveness, 0)

  const distribution = scores.map(team => {
    const idealShare = (team.attractiveness / totalAttractiveness) × marketDemand

    // Cap at production capacity
    const actualSales = Math.min(idealShare, team.capacity)

    return {
      teamId: team.teamId,
      idealDemand: idealShare,
      actualSales,
      unmetDemand: idealShare - actualSales,
      marketShare: (actualSales / marketDemand) × 100
    }
  })

  // Step 3: Redistribute unmet demand (if any team couldn't fulfill)
  const totalUnmetDemand = distribution.reduce((sum, d) => sum + d.unmetDemand, 0)

  if (totalUnmetDemand > 0) {
    // Find teams with spare capacity
    const teamsWithCapacity = distribution.filter(d => d.actualSales < d.capacity)

    // Redistribute proportionally to attractiveness
    // (Customers go to next best alternative)
    // Redistribution logic implemented in IMPROVED_GAME_FORMULAS.md
  }

  return distribution
}
```

**Status**: ✅ **REDESIGNED**
- [x] Found and analyzed original calculation
- [x] Created attractiveness-based competition model
- [x] Implemented redistribution for unmet demand
- [x] Added brand reputation accumulation
- [x] Documented in IMPROVED_GAME_FORMULAS.md Section 4
- [ ] Add brand loyalty mechanic (sticky market share)?
- [ ] Handle shortage/surplus scenarios

---

#### 3.3 Demand Calculation ✅ **REDESIGNED - See IMPROVED_GAME_FORMULAS.md Section 3**

**Original Problem**: Demand = Supply (circular logic)

**Improved Solution**: Fixed market sizes with independent growth

```typescript
const MARKET_BASE_DEMAND = {
  us: 1500,      // units per round
  asia: 4000,
  europe: 1200
}

const MARKET_GROWTH_RATES = {
  us: 0.03,      // 3% annual growth (mature)
  asia: 0.08,    // 8% annual growth (emerging)
  europe: 0.02   // 2% annual growth (mature)
}

function calculateRoundDemand(market, round, scenario) {
  // Natural growth
  const yearsElapsed = round / 12  // Assuming monthly rounds
  const growthFactor = Math.pow(1 + MARKET_GROWTH_RATES[market], yearsElapsed)

  // Scenario impact
  const scenarioMultiplier = 1 + (scenario.demandChange / 100)

  return Math.round(
    MARKET_BASE_DEMAND[market] × growthFactor × scenarioMultiplier
  )
}
```

**Status**: ✅ **REDESIGNED**
- [x] Identified circular logic problem
- [x] Created fixed base market sizes
- [x] Added realistic growth rates per market
- [x] Implemented scenario-based volatility
- [x] Documented in IMPROVED_GAME_FORMULAS.md Section 3

---

#### 3.4 Scenario System ✅ **REDESIGNED - See IMPROVED_GAME_FORMULAS.md Section 5**

**Original**: 8 scenarios, all parameters change by same %

**Improved**: 8 realistic economic scenarios with differentiated impacts

**Status**: ✅ **REDESIGNED**
- [x] Created 8 realistic scenarios (Boom, Recession, Stagflation, etc.)
- [x] Differentiated impacts (demand ≠ costs ≠ interest rates)
- [x] Added consumer preference shifts per scenario
- [x] Included supply chain reliability factors
- [x] Documented in IMPROVED_GAME_FORMULAS.md Section 5

**Recommendation**: Replace old system (new is strictly better)

---

#### 3.5 Financial Calculations 🔍 **REQUIRES VALIDATION**

**Systems Currently Implemented** (from game.php lines 410-574):

1. **Depreciation**: ✅ Working
   - Formula: `depreciation = depreciationRate × assetValue × 1000`
   - Method: Straight-line depreciation (industry standard for teaching)
   - **No changes needed** - appropriate for educational simulation

2. **Tax Calculation**: ✅ Working
   - Formula: `tax = profitBeforeTax × taxRate` (if profit > 0, else 0)
   - Loss carryforward: Not implemented (simplification for classroom)
   - **No changes needed** - adequate for game complexity

3. **Cash Flow**: ⚠️ **Could be enhanced**
   - Currently: Basic working capital adjustments
   - Missing: Full cash flow statement visualization
   - **Enhancement suggested**: Add cash flow statement display (not formula change)

4. **Short-term Loans**: ✅ Working
   - Auto-borrow to maintain minimum cash balance
   - Interest rate: Base rate + short-term premium
   - **No changes needed** - prevents teams from going bankrupt mid-game

**Status**: Financial formulas are **adequate** - focus on core gameplay formulas first

**Action Required**:
- [ ] Review each formula against accounting standards
- [ ] Propose improvements
- [ ] Test with sample scenarios

---

#### 3.6 Investment Lag (2 Rounds) ✅ **UNDERSTOOD - OK**

**Current Logic**:
- Round N: Decide to build plant
- Round N+1: Construction (pay cash, no capacity yet)
- Round N+2: Operational (capacity available)

**Assessment**: ✅ This is realistic and educational (capex timing)

**Keep as-is**: No changes needed

---

#### 3.7 R&D Lag (1 Round) ✅ **UNDERSTOOD - OK**

**Current Logic**:
- Round N: Invest in Tech 2
- Round N+1: Tech 2 available for production

**Assessment**: ✅ Realistic (R&D takes time)

**Keep as-is**: No changes needed

---

## 4. GOOGLE SHEETS DATABASE STRUCTURE

### ⚠️ CORRECTED: No "Late Submit" Status

**You're absolutely right** - once round is calculated, it's LOCKED. No late submissions possible.

### Sheet 1: GAMES (35 columns)

| Column | Field | Type | Example |
|--------|-------|------|---------|
| A | game_id | String | GAME_2024_001 |
| B | game_code | String | XY7K9M |
| C | educator_id | String | prof@edu |
| D | game_name | String | MBA Fall 2024 |
| E | created_date | DateTime | 2024-12-13 |
| F | status | Enum | `draft`, `active`, `completed` |
| G | no_of_teams | Integer | 5 |
| H | no_of_rounds | Integer | 3 |
| I | no_of_practice | Integer | 1 |
| J | hours_per_round | Integer | 48 |
| K | current_round | Integer | 1 |
| L | product_type | String | `phone` (future: `car`, `laptop`) |
| M-AJ | ... | ... | (Other game parameters) |

**Status values**:
- `draft` - Game created but not started
- `active` - Game in progress
- `completed` - All rounds finished
- **NO "late_submit"** - Not applicable!

---

### Sheet 7: TEAM_DECISIONS (Corrected Status)

| Column | Field | Type | Example |
|--------|-------|------|---------|
| A-H | ... | ... | (Same as before) |
| I | status | Enum | `draft`, `submitted`, `locked` |

**Status values**:
- `draft` - Saved in localStorage, not submitted
- `submitted` - Submitted before deadline
- `locked` - Round calculated, can't change anymore

**Business Logic**:
```typescript
// When admin clicks "Calculate Round"
function calculateRound(gameId, round) {
  // 1. Check deadline
  const roundInfo = getRoundAssumption(gameId, round)
  const now = new Date()

  if (now < roundInfo.deadline) {
    throw new Error("Can't calculate before deadline!")
  }

  // 2. Lock all submitted decisions
  const decisions = getTeamDecisions(gameId, round, status='submitted')
  decisions.forEach(d => {
    updateDecisionStatus(d.decision_id, 'locked')
  })

  // 3. Run calculations
  const results = runCalculations(decisions, roundInfo)

  // 4. Write results
  writeResults(results)

  // 5. Mark round as calculated
  updateRoundAssumption(gameId, round, { calculated: true })

  // NOW LOCKED - No more changes possible!
}

// When team tries to edit after calculation
function editDecision(decisionId) {
  const decision = getDecision(decisionId)

  if (decision.status === 'locked') {
    throw new Error("Round already calculated - can't edit!")
  }

  // Allow edit if still draft or submitted (before calculation)
  // ...
}
```

---

### Complete Sheet Structure (12 Sheets)

1. **Games** - All games
2. **Teams** - All teams
3. **Players** - Team members
4. **Scenarios** - Economic scenarios (8-10)
5. **Parameters_Master** - Auto-gen rules
6. **Round_Assumptions** - Market conditions per round
7. **Team_Decisions** - Submitted decisions (status: draft/submitted/locked)
8. **Round_Results** - Calculated financials
9. **Market_Share** - Competitive distribution
10. **Tech_Availability** - Network coverage
11. **Cost_Equations** - Cost formulas
12. **Audit_Log** - Change tracking

**Key Points**:
- ✅ No "late submit" - rounds lock after calculation
- ✅ Append-only logs (audit trail)
- ✅ JSON for complex data
- ✅ Batch API operations

---

## 5. WORKFLOW & BUSINESS LOGIC

### Game Creation Flow

```
Educator → Create Game Form
  ↓
Enter: name, teams (1-5), rounds (1-5), hours per round
  ↓
System Auto-Generates:
  - game_id, game_code (6 chars)
  - Team names (shuffle fruit array)
  - Team PINs (random 4-digit)
  - 76 parameters (from min/max ranges)
  - All rounds (0 to N) with random scenarios
  - Tech availability progression
  ↓
Write to Google Sheets (1 batch API call):
  - 1 row to Games
  - 5 rows to Teams
  - N+1 rows to Round_Assumptions
  - 3×(N+1) rows to Tech_Availability
  ↓
Return game_code to educator
```

---

### Round Lifecycle

```
Round N Starts
  ↓
Deadline: 48 hours (configurable)
  ↓
Teams submit decisions (anytime before deadline)
  - Auto-save to localStorage every 30s
  - Click "Submit" → Write to Team_Decisions sheet
  - Status: draft → submitted
  ↓
Deadline Passes
  ↓
Admin clicks "Calculate Round"
  ↓
System:
  1. Check all teams submitted (or use draft)
  2. Lock all decisions (submitted → locked)
  3. Fetch Round_Assumptions
  4. Run calculations:
     - Market share distribution
     - Sales per team
     - Production costs
     - P&L, Balance Sheet, Ratios
  5. Write to Round_Results + Market_Share
  6. Mark Round_Assumptions.calculated = TRUE
  ↓
Results Published (teams can view)
  ↓
Round N+1 Starts (if more rounds)
```

**CRITICAL**: Once "Calculate Round" runs, Round N is **LOCKED FOREVER**. No changes allowed!

---

## 6. IMPROVED DEMAND SYSTEM

### Fixed Market Sizes (Approved for Implementation)

```typescript
interface MarketDemand {
  baseSize: number        // Fixed base (independent of teams)
  growthRate: number      // Annual growth %
  volatility: number      // Scenario impact range ±%
}

const MARKETS: Record<string, MarketDemand> = {
  us: {
    baseSize: 1500,       // 1,500 units/round
    growthRate: 0.03,     // 3% annual growth (mature market)
    volatility: 0.15      // ±15% from scenarios
  },
  asia: {
    baseSize: 4000,       // 4,000 units/round (largest)
    growthRate: 0.08,     // 8% annual growth (emerging)
    volatility: 0.20      // ±20% (more volatile)
  },
  europe: {
    baseSize: 1200,       // 1,200 units/round
    growthRate: 0.02,     // 2% annual growth (mature)
    volatility: 0.10      // ±10% (most stable)
  }
}

function calculateMarketDemand(
  market: 'us' | 'asia' | 'europe',
  round: number,
  scenario: Scenario
): number {
  const config = MARKETS[market]

  // Natural growth (compounding)
  const yearsElapsed = round / 12  // Assuming monthly rounds
  const growthFactor = Math.pow(1 + config.growthRate, yearsElapsed)

  // Scenario impact (from scenario.demandChange %)
  const scenarioFactor = 1 + (scenario.demandChange / 100)

  // Final demand
  return Math.round(
    config.baseSize × growthFactor × scenarioFactor
  )
}
```

**Example**:
```
Round 0 (Practice):
  US: 1500 units
  Asia: 4000 units
  Europe: 1200 units
  Total: 6700 units

Round 1 (US=Boom+15%, Asia=Recession-10%, Europe=Stable):
  US: 1500 × 1.0025 × 1.15 = 1729 units
  Asia: 4000 × 1.0067 × 0.90 = 3624 units
  Europe: 1200 × 1.0017 × 1.00 = 1202 units
  Total: 6555 units
```

**Benefits**:
- ✅ Demand independent of supply (realistic!)
- ✅ Zero-sum competition (teams fight for share)
- ✅ Teaches capacity planning (can have shortage or surplus)
- ✅ Different markets have different characteristics

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Prototype (2024 Q4) - Working Game
**Goal**: Fully functional React app with phones

**Tasks**:
- [ ] Google Sheets setup (12 sheets)
- [ ] React services (API integration)
- [ ] Game creation (auto-generation)
- [ ] Login (game code + team PIN)
- [ ] Decision forms (all 7 areas)
- [ ] Calculation engine (TypeScript port)
- [ ] Results display (P&L, Balance Sheet, charts)

**Deliverable**: Can run a complete 3-round game with 5 teams

**Timeline**: 12-14 weeks

---

### Phase 2: Review & Improve (2025 Q1)
**Goal**: Fix identified issues, improve formulas

**Critical Reviews**:
- [ ] Cost equation - understand and improve
- [ ] Market share algorithm - find and enhance
- [ ] Financial calculations - review vs accounting standards
- [ ] Test all scenarios with real data
- [ ] Compare prototype vs original PHP

**Deliverable**: Validated, improved formulas

**Timeline**: 4-6 weeks

---

### Phase 3: Product-Agnostic (2025 Q2)
**Goal**: Support multiple product types

**Tasks**:
- [ ] Product configuration UI
- [ ] Allow educators to choose product type
- [ ] Generic naming (not "phone" everywhere)
- [ ] Configurable features/suppliers
- [ ] Test with cars, laptops, appliances

**Deliverable**: Can run games for any product

**Timeline**: 6-8 weeks

---

### Phase 4: Beta Testing (2025 Q3)
**Goal**: Test with real students

**Tasks**:
- [ ] Partner with 3-5 universities
- [ ] Run pilot courses
- [ ] Collect feedback
- [ ] Fix bugs and UX issues
- [ ] Performance optimization

**Deliverable**: Battle-tested system

**Timeline**: 12 weeks (summer semester)

---

### Phase 5: Polish & Launch (2025 Q4 - 2026 Q1)
**Goal**: Production-ready release

**Tasks**:
- [ ] Final UI polish
- [ ] Documentation (educator guide, student guide)
- [ ] Marketing materials
- [ ] Deployment infrastructure
- [ ] Support system

**Deliverable**: Bonopoly 2026 official release

**Timeline**: 8-12 weeks

---

## 8. FILE MANAGEMENT & HANDOFF PROTOCOL

### ⚠️ CRITICAL: File Organization System

**Problem**: Too many .md files, confusing which is latest

**Solution**: Clear file hierarchy

```
d:\Bonopoly\
├── MASTER_DESIGN_DOC.md          ⭐ THIS FILE - SINGLE SOURCE OF TRUTH
├── README.md                      📋 Project overview + quick start
├── CHANGELOG.md                   📝 Track all design decisions
│
├── drafts/                        📁 Research & draft documents
│   ├── ACTUAL_WORKFLOW.md         (Draft - merged into master)
│   ├── GAME_PARAMETERS_ANALYSIS.md
│   ├── HOW_ROUNDS_WORK.md
│   ├── DEMAND_CALCULATION.md
│   ├── DEMAND_SYSTEM_REDESIGN.md  (Approved - in master)
│   ├── COMPLETE_CALCULATION_FORMULAS.md
│   ├── GOOGLE_SHEETS_ARCHITECTURE.md
│   ├── IMPROVED_SCENARIO_SYSTEM.md
│   └── IMPLEMENTATION_ROADMAP.md
│
├── archive/                       🗄️ Old/deprecated files
│   └── (Move old files here when superseded)
│
└── bonopoly-react/                💻 React app code
    └── ... (existing React project)
```

### Handoff Protocol (For New Agent/Session)

**Step 1: Read This File First**
```
📖 START HERE: MASTER_DESIGN_DOC.md
```

**Step 2: Check CHANGELOG.md for Recent Decisions**
```
📝 What changed since last session?
```

**Step 3: Check Current Phase in Master Doc**
```
🎯 What are we working on now?
```

**Step 4: Reference Drafts Only If Needed**
```
📁 drafts/ contains detailed research
   Only read if you need deep dive into specific topic
```

### Updating This Document

**When making design decisions**:
1. Update relevant section in MASTER_DESIGN_DOC.md
2. Add entry to CHANGELOG.md with date + decision
3. Move superseded drafts to archive/

**Version Control**:
- Increment version number at top (1.0 → 1.1)
- Update "LAST UPDATED" date
- Add note in changelog

---

## 📝 CHANGELOG

### 2024-12-13 - v1.0 - Initial Design Complete
- ✅ Completed analysis of original PHP system
- ✅ Designed Google Sheets architecture (12 sheets)
- ✅ Proposed improved demand system (fixed market sizes)
- ✅ Proposed improved scenario system (10 realistic scenarios)
- ✅ Identified critical systems needing review (cost equation, market share)
- ✅ Designed product-agnostic configuration system
- ⚠️ Corrected: Removed "late submit" status (impossible after calculation)
- 🎯 Ready to start Phase 1 implementation

### Next Session Tasks
- [ ] Review cost equation with actual game data
- [ ] Find market share algorithm in PHP
- [ ] Create Google Spreadsheet template
- [ ] Start React services implementation

---

## 🎯 CURRENT STATUS

**Phase**: Design Complete → Ready for Implementation
**Next Step**: Create Google Sheets template + Start React services
**Blocking Issues**: None
**Questions for User**:
1. Approve improved demand system? ✅ APPROVED
2. Choose scenario system (original vs improved vs both)?
3. Should we review cost equation before or during implementation?

---

**END OF MASTER DESIGN DOCUMENT**

⭐ **Remember**: This is the ONLY file you need to read when starting work!
