# Bonopoly React Migration - Complete Implementation Roadmap

## Executive Summary

**Status**: ✅ Analysis & Design Phase COMPLETE

We now have a **complete understanding** of the original Bonopoly system and a **production-ready architecture** for the React + Google Sheets migration.

---

## What We've Accomplished

### 1. Complete System Analysis ✅

**Files Created**:
- `ACTUAL_WORKFLOW.md` - Real workflow (no CSV imports, full automation)
- `GAME_PARAMETERS_ANALYSIS.md` - All 76 educator input parameters
- `HOW_ROUNDS_WORK.md` - Scenario-based market evolution mechanism
- `DEMAND_CALCULATION.md` - How market demand is calculated and split
- `DEMAND_SYSTEM_REDESIGN.md` - Proposed improvements to demand system
- `COMPLETE_CALCULATION_FORMULAS.md` - All financial formulas, dependencies, data flow
- `GOOGLE_SHEETS_ARCHITECTURE.md` - Complete database structure (12 sheets)
- `IMPROVED_SCENARIO_SYSTEM.md` - 10 realistic scenarios vs 8 uniform ones

### 2. Key Discoveries

**Game Mechanics**:
- **8 predefined scenarios** apply random % changes that compound each round
- **29 market parameters** evolve dynamically (demand, costs, tax, interest, exchange rates, tech attractiveness)
- **Team names**: Auto-generated from shuffled fruit/vegetable array
- **Market split**: US 30-35%, Asia 40-45%, Europe auto-calculated
- **Tech availability**: Network coverage progression per round
- **Investment lag**: 2 rounds (decide → construct → operational)
- **R&D lag**: 1 round (invest → available)

**Problems Identified & Solutions Proposed**:
1. ❌ **Demand = Supply** (circular logic) → ✅ Fixed market sizes
2. ❌ **Uniform scenario changes** → ✅ Mixed realistic effects
3. ❌ **Equal starting positions** → ✅ Competitive from Round 0
4. ❌ **Manual parameter entry** → ✅ Auto-generation from ranges

### 3. Architecture Designed

**ONE Google Spreadsheet** = Entire database

**12 Sheets**:
1. **Games** - All games created (35 columns)
2. **Teams** - All teams (15 columns)
3. **Players** - Team members (10 columns)
4. **Scenarios** - 8-10 economic scenarios (5 columns)
5. **Parameters_Master** - Auto-generation rules (6 columns, 76 rows)
6. **Round_Assumptions** - Market conditions per round (40+ columns)
7. **Team_Decisions** - All decisions as JSON (13 columns)
8. **Round_Results** - Calculated results as JSON (12 columns)
9. **Market_Share** - Competitive distribution (15 columns)
10. **Tech_Availability** - Network coverage (8 columns)
11. **Cost_Equations** - Cost formulas (6 columns)
12. **Audit_Log** - Change tracking (9 columns)

**Key Insights**:
- JSON compression for complex nested data (decisions, results)
- Append-only logs for audit trail
- Batch API operations (1 call for multiple sheets)
- Smart caching (static vs dynamic data)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: React app reads and displays game data from Google Sheets

**Tasks**:
1. Set up Google Sheets
   - [ ] Create `Bonopoly_Database` spreadsheet
   - [ ] Create 12 sheets with proper columns
   - [ ] Pre-populate Scenarios sheet (8-10 scenarios)
   - [ ] Pre-populate Parameters_Master (76 auto-gen rules)
   - [ ] Set up Google Cloud project
   - [ ] Enable Sheets API v4
   - [ ] Create Service Account credentials

2. React Project Setup
   - [ ] Already done: Vite + React + TypeScript
   - [ ] Install Google Sheets API client
   - [ ] Set up environment variables
   - [ ] Configure API authentication

3. Data Layer Services
   - [ ] `services/googleSheets.ts` - API wrapper
   - [ ] `services/gameService.ts` - Game CRUD
   - [ ] `services/teamService.ts` - Team operations
   - [ ] `services/roundService.ts` - Round data
   - [ ] Caching layer with TTL

4. TypeScript Interfaces (update existing)
   - [ ] Match Google Sheets structure exactly
   - [ ] Add JSON parse/stringify helpers
   - [ ] Validation schemas

5. Basic Components
   - [ ] Login (game code + team PIN)
   - [ ] Game Dashboard (read-only)
   - [ ] Team Roster viewer
   - [ ] Round Schedule viewer
   - [ ] Simple results viewer

**Deliverable**: Can login, view game info, see past results

---

### Phase 2: Game Creation & Admin (Weeks 3-4)

**Goal**: Educators can create games, system auto-generates everything

**Tasks**:
1. Game Creation Wizard
   - [ ] Step 1: Basic info (name, teams, rounds)
   - [ ] Step 2: Review auto-generated parameters
   - [ ] Step 3: Customize if needed (optional)
   - [ ] Step 4: Confirm & create

2. Auto-Generation Logic
   - [ ] Fetch Parameters_Master from Sheets
   - [ ] Randomize from min/max ranges
   - [ ] Generate team names (shuffle fruit array)
   - [ ] Generate team PINs (random 4-digit)
   - [ ] Generate game code (random 6-char)

3. Round Generation
   - [ ] Create Round 0 (practice) with base params
   - [ ] Create Rounds 1-N with random scenarios
   - [ ] Apply compounding formula
   - [ ] Generate tech availability progression

4. Batch Write to Sheets
   - [ ] 1 row to Games
   - [ ] 5 rows to Teams
   - [ ] N+1 rows to Round_Assumptions
   - [ ] 3×(N+1) rows to Tech_Availability
   - [ ] All in 1 API call

5. Admin Dashboard
   - [ ] View all games
   - [ ] View game details
   - [ ] View team submissions
   - [ ] Trigger round calculation
   - [ ] View/export results

**Deliverable**: Educators can create fully configured games in 2 minutes

---

### Phase 3: Decision Forms (Weeks 5-8)

**Goal**: Teams can make all 7 decision areas and submit

**Tasks**:
1. localStorage Service
   - [ ] Auto-save every 30 seconds
   - [ ] Version control (prevent conflicts)
   - [ ] Clear old data (keep <2MB)
   - [ ] Conflict resolution

2. Production Form
   - [ ] Demand forecast slider
   - [ ] Capacity allocation (own vs outsource)
   - [ ] Supplier selection (1-4)
   - [ ] Tech distribution (1-4)
   - [ ] Per market (US, Asia, Europe)

3. HR Form
   - [ ] Employee count
   - [ ] Salary levels
   - [ ] Training budget
   - [ ] Hiring/layoffs

4. R&D Form
   - [ ] Technology investments (Tech 2-4)
   - [ ] Feature investments
   - [ ] Budget allocation

5. Investment Form
   - [ ] New plant construction
   - [ ] Track 2-round lag
   - [ ] Visual timeline

6. Logistics Form
   - [ ] Transfer pricing
   - [ ] Inter-market shipments
   - [ ] Tariff calculations

7. Marketing Form
   - [ ] Features per tech
   - [ ] Pricing per tech per market
   - [ ] Promotion % per tech per market

8. Finance Form
   - [ ] Long-term loans
   - [ ] Dividend policy
   - [ ] Share issues

9. Validation Engine
   - [ ] Cross-field validation
   - [ ] Business rules
   - [ ] Real-time feedback
   - [ ] Warning vs error distinction

10. Submit Flow
    - [ ] Final validation
    - [ ] Compress to JSON
    - [ ] Append to Team_Decisions sheet
    - [ ] Update Teams.rounds_submitted
    - [ ] Confirmation message

**Deliverable**: Teams can make complete decisions and submit

---

### Phase 4: Calculation Engine (Weeks 9-12)

**Goal**: Calculate round results and display financials

**Tasks**:
1. Market Share Calculator
   - [ ] Fetch all team decisions for round
   - [ ] Calculate attractiveness scores
   - [ ] Apply consumer preferences (from scenario)
   - [ ] Distribute demand proportionally
   - [ ] Cap at production capacity
   - [ ] Track lost sales

2. Production Calculator
   - [ ] Calculate capacity used
   - [ ] Apply learning curve
   - [ ] Calculate unit costs
   - [ ] Handle outsourcing

3. Sales Calculator
   - [ ] Market share × demand = sales
   - [ ] Apply price
   - [ ] Calculate revenue
   - [ ] Handle inventory

4. Cost Calculator
   - [ ] Variable costs (materials, labour)
   - [ ] Fixed costs (admin)
   - [ ] Feature costs
   - [ ] Transportation costs
   - [ ] Promotion costs
   - [ ] R&D costs

5. P&L Calculator
   - [ ] Revenue
   - [ ] Total costs
   - [ ] EBITDA
   - [ ] Depreciation
   - [ ] EBIT
   - [ ] Interest
   - [ ] Tax
   - [ ] Profit after tax

6. Balance Sheet Calculator
   - [ ] Assets (fixed, inventory, receivables, cash)
   - [ ] Liabilities (LT loans, ST loans, payables)
   - [ ] Equity (share capital, retained earnings, profit)
   - [ ] Balance check

7. Ratios Calculator
   - [ ] Market cap, share price
   - [ ] Profitability (EBITDA%, EBIT%, ROS, ROE, ROCE)
   - [ ] Leverage (equity ratio, debt/equity)
   - [ ] Per-share (EPS, P/E, dividend)
   - [ ] TSR (total shareholder return)

8. Temporal Effects
   - [ ] Track investments (2-round lag)
   - [ ] Track R&D (1-round lag)
   - [ ] Accumulate retained earnings
   - [ ] Update opening balances

9. Batch Write Results
   - [ ] Compress to JSON
   - [ ] Write to Round_Results (5 rows)
   - [ ] Write to Market_Share (15 rows)
   - [ ] Update Round_Assumptions.calculated=TRUE

10. Precision & Validation
    - [ ] Use decimal.js for finance
    - [ ] Regression tests vs PHP
    - [ ] Balance sheet must balance
    - [ ] Sanity checks (e.g., cash > 0)

**Deliverable**: Full financial results calculated accurately

---

### Phase 5: Results Display (Weeks 13-14)

**Goal**: Teams can view beautiful, insightful results

**Tasks**:
1. P&L Statement Component
   - [ ] Revenue breakdown
   - [ ] Cost breakdown
   - [ ] Margins highlighted
   - [ ] Comparison to previous round

2. Balance Sheet Component
   - [ ] Assets side
   - [ ] Liabilities side
   - [ ] Equity side
   - [ ] Balance visualization

3. Ratios Dashboard
   - [ ] Key metrics cards
   - [ ] Trend charts
   - [ ] Peer comparison
   - [ ] Industry benchmarks

4. Market Share Charts
   - [ ] Pie chart per market
   - [ ] Trend over rounds
   - [ ] Tech split
   - [ ] Competitive positioning

5. Rankings Leaderboard
   - [ ] By TSR
   - [ ] By market cap
   - [ ] By profit
   - [ ] Historical rankings

6. Scenario Display
   - [ ] Show scenario name/description
   - [ ] Show parameter changes
   - [ ] Explain impact on results

7. Export & Print
   - [ ] PDF export
   - [ ] Excel export
   - [ ] Print-friendly view

**Deliverable**: Comprehensive results visualization

---

### Phase 6: Testing & Polish (Weeks 15-16)

**Tasks**:
1. Unit Tests
   - [ ] Calculation functions
   - [ ] Validation logic
   - [ ] Data transformations

2. Integration Tests
   - [ ] Full game creation flow
   - [ ] Decision submission flow
   - [ ] Calculation flow
   - [ ] Results display

3. End-to-End Tests
   - [ ] Complete 3-round game
   - [ ] 5 teams competing
   - [ ] Verify results match expectations

4. Performance Testing
   - [ ] Load testing (100+ games)
   - [ ] API rate limits respected
   - [ ] Cache hit rates
   - [ ] Page load times

5. User Testing
   - [ ] Educator beta test
   - [ ] Student beta test
   - [ ] Collect feedback
   - [ ] Iterate

6. Documentation
   - [ ] Educator guide
   - [ ] Student guide
   - [ ] API documentation
   - [ ] Deployment guide

7. Deployment
   - [ ] Set up hosting (Vercel/Netlify)
   - [ ] Configure domain
   - [ ] Set up monitoring
   - [ ] Backup strategy

**Deliverable**: Production-ready system

---

## Technology Stack (Confirmed)

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (already set up)
- **Material-UI (MUI)** - Component library
- **React Router** - Navigation
- **React Query** - Data fetching/caching
- **Recharts** - Charts/graphs
- **decimal.js** - Financial precision
- **Zod** - Validation schemas

### Backend (Serverless)
- **Google Sheets API v4** - Database
- **Google Cloud Functions** (optional) - Calculations
- **Service Account Auth** - Secure access

### Storage
- **Google Sheets** - Primary database (all games)
- **localStorage** - Draft decisions (auto-save)

### DevOps
- **GitHub** - Version control
- **GitHub Actions** - CI/CD
- **Vercel/Netlify** - Hosting
- **Sentry** - Error monitoring

---

## Risk Mitigation

### Risk 1: Google Sheets Rate Limits
**Mitigation**:
- ✅ Only 5 teams = max 6 API calls per round (way under 60/min)
- ✅ Batch operations (1 call for multiple sheets)
- ✅ Aggressive caching (5-min for static, 1-min for dynamic)
- ✅ Retry logic with exponential backoff

### Risk 2: Calculation Accuracy
**Mitigation**:
- ✅ Use decimal.js for all financial math
- ✅ Regression tests against PHP output
- ✅ Balance sheet balance check
- ✅ Sanity checks (e.g., profit in reasonable range)

### Risk 3: localStorage Size
**Mitigation**:
- ✅ 5MB limit is plenty (200KB for 20 rounds × 5 teams)
- ✅ Only store active round + 2 previous
- ✅ Compress JSON
- ✅ Clear old data

### Risk 4: Concurrent Edits
**Mitigation**:
- ✅ Version control (increment on submit)
- ✅ Timestamp-based conflict resolution
- ✅ localStorage prevents overwrites within team
- ✅ Different teams write different rows (no conflict)

### Risk 5: Complex Validation
**Mitigation**:
- ✅ Zod schemas for type safety
- ✅ Tiered validation (warnings vs errors)
- ✅ Real-time feedback as user types
- ✅ Final validation on submit

---

## Success Metrics

### Technical
- [ ] Page load < 2 seconds
- [ ] API calls < 10 per user session
- [ ] Cache hit rate > 80%
- [ ] Zero data loss incidents
- [ ] 99.9% uptime

### Educational
- [ ] Students complete all rounds (completion rate > 90%)
- [ ] Positive feedback on realism (> 4/5 rating)
- [ ] Educators find setup easy (< 5 minutes)
- [ ] Learning objectives met (measured via assessment)

### Business
- [ ] Cost < $50/month for 100 games (Google Sheets + hosting)
- [ ] Zero manual intervention needed per game
- [ ] Can scale to 500+ concurrent users

---

## Next Steps (Ready to Code!)

### Immediate Actions:
1. **Create Google Spreadsheet**
   - Set up 12 sheets
   - Pre-populate Scenarios + Parameters_Master
   - Configure Service Account

2. **Update React Project**
   - Install Google Sheets client
   - Create services folder
   - Implement googleSheets.ts

3. **Start with Phase 1**
   - Login component
   - Game dashboard
   - Basic data display

### Can Use Parallel Development:
- **Agent 1**: Build frontend components (UI/UX)
- **Agent 2**: Build calculation engine (TypeScript)
- **Agent 3**: Set up Google Sheets + API integration

This will accelerate development significantly!

---

## Conclusion

We now have:
✅ **Complete understanding** of original system
✅ **Production-ready architecture** designed
✅ **Clear implementation roadmap** with phases
✅ **Risk mitigation strategies** identified
✅ **Technology stack** selected
✅ **Success metrics** defined

**Estimated Timeline**: 14-16 weeks for full implementation

**Ready to begin Phase 1!** 🚀

---

## Questions Before Starting Implementation

1. **Demand System**: Should we implement the improved fixed-market-size system or keep original capacity-based?
   - Recommendation: Start with original (backward compatible), add improved as "Advanced Mode" later

2. **Scenario System**: Original 8 uniform scenarios or new 10 realistic scenarios?
   - Recommendation: Implement both, let educators choose

3. **Cloud Functions**: Client-side calculations (Phase 4) or Cloud Functions (more secure)?
   - Recommendation: Start client-side (faster development), migrate to Cloud Functions in Phase 6

4. **Deployment**: Self-hosted or managed (Vercel/Netlify)?
   - Recommendation: Vercel (zero config, free tier, auto-deploy from GitHub)

Once these are decided, we can start coding immediately!
