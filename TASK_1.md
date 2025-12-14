# Task 1: React Web Application Development

## ✅ Completed So Far

### 1. Database Layer (Google Sheets + Apps Script)
- ✅ Google Apps Script deployed as database layer (READ/WRITE/UPDATE only)
- ✅ Apps Script URL: `https://script.google.com/macros/s/AKfycbw_qGZbwl9pHyT7_oASmYBWOBpI0yu4OpCajHaV8j-9qw76CJKcAoPhWR5mb33545IP/exec`
- ✅ Config file created: `bonopoly-react/src/config/googleSheets.ts`
- ✅ API service created: `bonopoly-react/src/services/googleSheetsApi.ts`
- ✅ Test page created and working: `test-pages/test-simple.html`
  - Floating popup notifications
  - Pre-filled sample data
  - Authentication testing (educator + team login)
  - Full CRUD operations (Create, Read, Update)
  - Editable filter fields
- ✅ Authentication System (React)
  - AuthContext with educator/team login
  - Session persistence with localStorage
  - Login page UI with role selection
- ✅ Debug Logger Service
  - Comprehensive API request/response logging
  - Error tracking with stack traces
- ✅ Notification System
  - Toast notifications (success/error/info)
  - NotificationContext provider
- ✅ Game Creation Wizard (Complete)
  - Single-page form with all game settings
  - Auto-generated team names (fun/random)
  - Automatic team creation with unique PINs
  - Round scenarios with randomized scenario IDs (1-8)
  - Success screen with game credentials
  - Team-specific login links with pre-filled PINs
  - Auto-login to educator dashboard

### 2. Game Design & Formulas
- ✅ Complete game formula redesign documented in `IMPROVED_GAME_FORMULAS.md`
- ✅ Cost equation: Separated fixed/variable costs with capacity utilization
- ✅ Market demand: Fixed base market sizes (no circular logic)
- ✅ Market share: Attractiveness-based competition
- ✅ Scenarios: 8 realistic economic scenarios
- ✅ Database schema: 5 sheets (Game, Teams, Decisions, Outputs, Round_Scenarios)

### 3. Current Architecture
**React handles:**
- ✅ ALL authentication logic
- ✅ ALL calculations (costs, demand, market share, P&L)
- ✅ ALL business logic
- ✅ Visibility rules (devMode vs deadline checking)

**Apps Script handles:**
- ✅ Database operations ONLY (read, write, update)

---

## 🎯 Next Task: React Application Development

### Phase 1: Setup & Core Infrastructure

#### 1.1 Project Structure Review
- [ ] Review existing React project structure in `bonopoly-react/`
- [ ] Verify all dependencies are installed
- [ ] Check TypeScript configuration
- [ ] Review routing setup (if exists)

#### 1.2 Authentication System
- [x] Create authentication context/store
- [x] Implement educator login flow
  - Input: `game_code` (6 chars) + `game_pin` (7 digits)
  - Validate against Google Sheets Game table
  - Store session (game info, educator email)
- [x] Implement team login flow
  - Input: `game_code` (6 chars) + `team_pin` (7 digits)
  - Validate against Google Sheets Teams table
  - Store session (game info, team info)
- [x] Create login page UI
- [x] Add logout functionality
- [x] Add session persistence (localStorage)

#### 1.3 Debug Mode & Error Handling
**IMPORTANT: Enhanced debugging in dev mode**
- [x] Create debug logger service
  - In dev mode: Log ALL API requests/responses
  - In dev mode: Show detailed error messages with full stack traces
  - In prod mode: Show user-friendly error messages only
- [ ] Create error boundary component
- [x] Add toast/notification system (similar to test page but more robust)
  - Success notifications
  - Error notifications with details in dev mode
  - Loading states
- [ ] Debug panel component (dev mode only)
  - Show all API calls
  - Show calculation results step-by-step
  - Show game state
  - Toggle visibility rules override

---

### Phase 2: Educator Dashboard

#### 2.1 Game Creation Wizard
- [x] Step 1: Basic Info
  - Game name
  - Educator email
  - Number of teams (3-8)
  - Number of rounds (3-6)
  - Hours per round (default: 168 = 1 week)
  - Timezone selection
  - Template selection (Easy/Medium/Hard) - loads different parameters
  - Team names and emails (auto-generated fun names)
- [x] Step 2: Review & Confirm
  - Generate `game_code` (6 chars)
  - Generate `game_pin` (7 digits)
  - Show summary
  - Create game in Google Sheets
  - Create all teams automatically
  - Create round scenarios with randomized scenario IDs
- [x] Step 3: Success Screen
  - Display game_code and game_pin prominently
  - Show team login links with pre-filled PINs
  - Copy/share functionality for each team
  - Auto-login button to educator dashboard

#### 2.2 Educator Dashboard (Complete)
- [x] Dashboard Overview Tab
  - Game statistics (teams, submissions, rounds)
  - Current round scenario display
  - Game information card
- [x] Team Monitoring Tab
  - See which teams submitted decisions
  - See submission timestamps
  - Submission status (submitted/pending)
- [x] Results Tab
  - View all teams' results (revenue, costs, profit)
  - Results visibility based on deadline
  - Dev mode override for testing
- [x] Game Settings Dialog
  - Update current_round
  - Update status (active/paused/completed)
  - Update total rounds
- [x] Dev Mode Toggle
  - Override visibility rules
  - Show results before deadline
  - Warning indicator when active
- [x] Header with game info and actions
  - Game code, current round, status chips
  - Refresh button for live updates
  - Settings button
  - Logout button

#### 2.3 Additional Features (Future)
- [ ] Download results as CSV/Excel
- [ ] Leaderboard view with rankings
- [ ] Manually lock/unlock team decisions
- [ ] Edit round scenarios after creation
- [ ] Email notifications to teams

---

### Phase 3: Team Dashboard

#### 3.1 Decision Input Forms
- [ ] Production decisions
  - US region: total_production, total_outsource
  - Asia region: total_production, total_outsource
  - Europe region: total_production, total_outsource
  - Real-time cost preview
- [ ] HR decisions
  - US: employees, wage, training_budget
  - Asia: employees, wage, training_budget
  - Europe: employees, wage, training_budget
  - Real-time cost preview
- [ ] Marketing decisions
  - US: price, promotion
  - Asia: price, promotion
  - Europe: price, promotion
  - Real-time revenue preview

#### 3.2 Decision Validation & Submission
- [ ] Input validation
  - Capacity constraints
  - Budget constraints
  - Reasonable ranges
- [ ] Save draft (auto-save)
- [ ] Submit decision
  - Lock after submission
  - Show confirmation
  - Prevent re-submission unless unlocked by educator
- [ ] View submitted decision (read-only after submission)

#### 3.3 Results Dashboard
- [ ] P&L Statement
  - Revenue breakdown by region
  - Cost breakdown (fixed vs variable)
  - Profit after tax
- [ ] KPI Cards
  - Brand reputation
  - Cumulative production
  - Market share by region
  - Cash position
- [ ] Charts & Visualizations
  - Trend charts (revenue, profit over rounds)
  - Regional comparison charts
  - Competitor comparison (if visible)

#### 3.4 Historical View
- [ ] View all previous rounds
  - Past decisions
  - Past results
  - Trend analysis

---

### Phase 4: Calculation Engine (CRITICAL)

**Location: `bonopoly-react/src/services/calculations/`**

#### 4.1 Cost Calculations
Reference: `IMPROVED_GAME_FORMULAS.md` Section 1
- [ ] Fixed costs calculation
  - Plant maintenance
  - Fixed labor
  - Plant depreciation
- [ ] Variable costs calculation
  - Direct labor (with utilization efficiency curve)
  - Materials
  - Outsourcing costs
  - Promotion costs
- [ ] Total cost aggregation
- [ ] Unit tests for all cost formulas

#### 4.2 Market Demand Calculations
Reference: `IMPROVED_GAME_FORMULAS.md` Section 2
- [ ] Base market size (fixed per region)
- [ ] Scenario effects multipliers
- [ ] Total market demand per region
- [ ] Unit tests

#### 4.3 Market Share & Sales Calculations
Reference: `IMPROVED_GAME_FORMULAS.md` Section 3
- [ ] Attractiveness calculation
  - Price factor (exponential decay)
  - Promotion factor
  - Brand factor
- [ ] Competitive market share distribution
- [ ] Sales = market_share × total_demand
- [ ] Unit tests with multi-team scenarios

#### 4.4 P&L & Financial Calculations
Reference: `IMPROVED_GAME_FORMULAS.md` Section 4
- [ ] Revenue calculation
- [ ] Operating profit
- [ ] Tax calculation
- [ ] Profit after tax
- [ ] Cash flow (future)
- [ ] Unit tests

#### 4.5 KPI Calculations
- [ ] Brand reputation evolution
  - Quality impact
  - Delivery impact
  - Decay over time
- [ ] Cumulative production tracking
- [ ] Unit tests

#### 4.6 Results Processing Service
- [ ] Fetch all teams' decisions for a round
- [ ] Run calculations for all teams
- [ ] Save outputs to Google Sheets
- [ ] Handle errors gracefully
- [ ] Add extensive logging (dev mode)

---

### Phase 5: Testing & Refinement

#### 5.1 Unit Tests
- [ ] Authentication service tests
- [ ] API service tests (mocked)
- [ ] Calculation engine tests (comprehensive)
- [ ] Form validation tests

#### 5.2 Integration Tests
- [ ] Full game creation flow
- [ ] Decision submission flow
- [ ] Results calculation flow
- [ ] Authentication flow

#### 5.3 Manual Testing Scenarios
- [ ] Create game with 3 teams
- [ ] All teams submit decisions
- [ ] Run calculations
- [ ] Verify results match expected values
- [ ] Test deadline enforcement
- [ ] Test dev mode override
- [ ] Test all error scenarios

#### 5.4 UI/UX Polish
- [ ] Responsive design (mobile-friendly)
- [ ] Loading states everywhere
- [ ] Error states with helpful messages
- [ ] Empty states (no data yet)
- [ ] Smooth transitions & animations

---

### Phase 6: Production Readiness

#### 6.1 Environment Configuration
- [ ] Separate dev/prod configs
- [ ] Environment variables for API URL
- [ ] Build configuration

#### 6.2 Performance Optimization
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Memoization for expensive calculations
- [ ] Debouncing for auto-save

#### 6.3 Security Review
- [ ] Input sanitization
- [ ] XSS prevention
- [ ] CSRF protection (if needed)
- [ ] Rate limiting considerations

#### 6.4 Documentation
- [ ] User guide for educators
- [ ] User guide for students
- [ ] Developer documentation
- [ ] API documentation
- [ ] Deployment guide

---

## 🚀 Immediate Next Steps

### CURRENT PROGRESS:
✅ Authentication system complete
✅ Game creation wizard complete
✅ Debug logger complete
✅ Notification system complete
✅ **Educator Dashboard complete** (Phase 2.2)
   - 3-tab interface (Overview, Team Status, Results)
   - Real-time team monitoring
   - Game settings management
   - Dev mode toggle

### NEXT PRIORITY:

1. **Build Team Dashboard** (Phase 3) - RECOMMENDED NEXT STEP
   - Decision input forms (Production, HR, Marketing)
   - Real-time validation and cost preview
   - Submit/save decisions
   - View results after deadline

2. **Implement Calculation Engine** (Phase 4)
   - Cost calculations
   - Market demand calculations
   - Market share distribution
   - P&L calculations
   - Save results to Outputs sheet

---

## 📝 Notes

### Debug Mode Requirements (CRITICAL)
In dev mode, the app MUST:
- Print ALL API requests with full URL and parameters
- Print ALL API responses (success AND error, full JSON)
- Print ALL calculation steps (input → formula → output)
- Show error stack traces
- Allow toggling visibility rules
- Show hidden game state (scenario IDs, internal parameters)

In production mode:
- Only show user-friendly error messages
- Hide technical details
- Hide debug panel

### Calculation Priority
The calculation engine is CRITICAL. We need:
- 100% accuracy (matches formulas in IMPROVED_GAME_FORMULAS.md)
- Comprehensive unit tests
- Step-by-step logging in dev mode
- Clear error messages when calculations fail

### Result Visibility Logic
- Always calculate and save results (visible=true in DB)
- Frontend checks: `devMode || (now > deadline)` to show results
- Never rely on Apps Script for business logic

---

## 🎯 Success Criteria

Phase 1-2 Complete when:
- [ ] Educator can create a game
- [ ] Educator can create teams
- [ ] Educator can see game dashboard
- [ ] Debug mode shows all API calls and responses
- [ ] Error handling works correctly

Phase 3 Complete when:
- [ ] Team can login
- [ ] Team can submit decisions
- [ ] Team can view past decisions
- [ ] Auto-save works

Phase 4 Complete when:
- [ ] All formulas implemented correctly
- [ ] Unit tests pass with 100% accuracy
- [ ] Multi-team calculations work
- [ ] Results saved to Google Sheets

Phase 5-6 Complete when:
- [ ] Full end-to-end game flow works
- [ ] All tests pass
- [ ] UI is polished
- [ ] Documentation complete
- [ ] Ready for deployment

---

**Last Updated:** 2024-12-14
**Status:** Phase 1 & 2 Complete ✅ (Educator Flow Finished!)
**Next Action:** Build Team Dashboard (Phase 3) - Let teams submit decisions!

## 🐛 Recent Bug Fixes
- Fixed hardcoded scenario_id bug (was always 8, now randomized 1-8 for each country/round)
- Added auto-login flow after game creation (educator automatically logs in and goes to dashboard)

## 📸 Screenshots/Features Added Today
- **Educator Dashboard**: Full-featured 3-tab interface with:
  - Overview tab showing game stats, current scenarios, and game info
  - Team Status tab with real-time submission monitoring
  - Results tab with P&L summaries (respects deadline unless dev mode)
  - Settings dialog to update round, status, and game parameters
  - Dev mode toggle with visual warning
