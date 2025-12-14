# Bonopoly React Migration - Developer Handoff Documentation

## Project Overview
Migrating Bonopoly (PHP/MySQL business simulation game) to React + Google Sheets + localStorage.

**Key Constraints:**
- Max 5 teams per game (classroom setting)
- Max 5 rounds per game (typically 3 rounds)
- Non-real-time gameplay (rounds last hours/days, e.g., submit by tomorrow 5PM)
- One submit per round per team (can edit until deadline)

---

## Current Status: Phase 1 - Foundation

### ✅ Completed Tasks
- [x] Planning and architecture design
- [x] React + TypeScript project setup
- [x] Data models/interfaces created
- [x] Google Sheets template structure (9 CSV files ready for import)
- [ ] Basic authentication

### 🔨 In Progress
- Waiting for Google Sheets import and API setup (user's turn)

### ⏳ Next Up (for you or parallel work)
1. ⭐ **YOU**: Import Google Sheets templates following `google-sheets-templates/IMPORT_INSTRUCTIONS.md`
2. ⭐ **YOU**: Set up Google Cloud project + enable Sheets API
3. ⭐ **YOU**: Create service account + share spreadsheet
4. Build `src/services/googleSheets.ts` - API wrapper for reading/writing Sheets
5. Implement team authentication with login codes

---

## Architecture Summary

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: Material-UI (or Ant Design)
- **State Management**: React Context API
- **Data Storage**:
  - Google Sheets (config, decisions, results)
  - localStorage (draft decisions, auto-save)
- **Data Fetching**: React Query
- **Charts**: Recharts or Chart.js
- **API**: Google Sheets API v4

### Google Sheets Structure
Each game = 1 Google Spreadsheet with 9 sheets:

```
Sheet 1: Game_Settings
├── Columns: Setting | Value | Description
├── Rows: 13 game configuration settings (cost_equation, no_of_rounds, depreciation_rate, etc.)

Sheet 2: Game_Parameters
├── Columns: Parameter | Value | Description
├── Rows: Default parameters (HR, Finance, Inventory, R&D defaults)

Sheet 3: Tech_Network_Coverage
├── Columns: Round | US_Tech1 | US_Tech2 | US_Tech3 | US_Tech4 | Asia_Tech1...
├── Rows: One per round (network infrastructure availability by technology and market)

Sheet 4: Round_Market_Params
├── Columns: Round | Market | [26 market parameters with clear names]
├── Rows: 3 per round (US, Asia, Europe market conditions)
├── Replaces mystery 26-value CSV strings from original system

Sheet 5: Round_Schedule
├── Columns: Round | Scenario | Deadline | Status | Notes
├── Rows: One per round (max 5 rounds)

Sheet 6: Teams
├── Columns: team_id | team_name | login_code | members | email | created_at
├── Rows: 5 teams (max)

Sheet 7: Team_Decisions (append-only)
├── Columns: round | team_id | timestamp | status | decisions_json | submitted_by | ip_address
├── Example decisions_json: {"production":{...}, "hr":{...}, "rnd":{...}, "investment":{...}, "logistics":{...}, "marketing":{...}, "finance":{...}}
├── Rows: Populated by React app (all 7 decision areas as JSON)

Sheet 8: Round_Results (append-only)
├── Columns: round | team_id | results_json
├── Example results_json: {"pnl": {...}, "balanceSheet": {...}, "marketShare": {...}, "ratios": {...}}
├── Rows: Written after round calculations

Sheet 9: Audit_Log (optional)
├── Columns: timestamp | user | action | details
├── Rows: Track all changes for integrity
```

**📦 Template Files Available:** See `google-sheets-templates/` folder with 9 CSV files ready for import

### localStorage Strategy
**Decision:** NOT using localStorage for primary data storage (user confirmed)
- All data stored in Google Sheets only
- May use localStorage for temporary draft auto-save (optional enhancement)
- Simplifies architecture and ensures single source of truth

---

## Project Structure

```
bonopoly-react/
├── public/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── GameCreator.tsx
│   │   │   ├── RoundManager.tsx
│   │   │   ├── TeamManager.tsx
│   │   │   └── RoundCalculator.tsx
│   │   ├── player/
│   │   │   ├── DecisionForms/
│   │   │   │   ├── ProductionForm.tsx
│   │   │   │   ├── HRForm.tsx
│   │   │   │   ├── RnDForm.tsx
│   │   │   │   ├── InvestmentForm.tsx
│   │   │   │   ├── LogisticsForm.tsx
│   │   │   │   ├── MarketingForm.tsx
│   │   │   │   └── FinanceForm.tsx
│   │   │   ├── ResultsDisplay/
│   │   │   │   ├── PnLStatement.tsx
│   │   │   │   ├── BalanceSheet.tsx
│   │   │   │   ├── MarketShareCharts.tsx
│   │   │   │   └── Rankings.tsx
│   │   │   └── Dashboard.tsx
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Navbar.tsx
│   │       └── Loading.tsx
│   ├── services/
│   │   ├── googleSheets.ts        // Google Sheets API wrapper
│   │   ├── localStorage.ts        // localStorage service
│   │   └── calculations/
│   │       ├── demandCalculator.ts
│   │       ├── productionCalculator.ts
│   │       ├── hrCalculator.ts
│   │       ├── salesCalculator.ts
│   │       ├── logisticsCalculator.ts
│   │       ├── financeCalculator.ts
│   │       ├── pnlCalculator.ts
│   │       ├── balanceSheetCalculator.ts
│   │       └── ratiosCalculator.ts
│   ├── types/
│   │   ├── Game.ts
│   │   ├── Team.ts
│   │   ├── Round.ts
│   │   ├── Decision.ts
│   │   ├── Output.ts
│   │   └── FinancialData.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── GameContext.tsx
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useGoogleSheets.ts
│   │   └── useAutoSave.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   └── formatting.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Phase Breakdown

### Phase 1: Foundation (Current - Week 1-2)
**My Focus:**
- [ ] Initialize React + TypeScript + Vite project
- [ ] Set up folder structure
- [ ] Install dependencies (MUI, React Query, etc.)
- [ ] Create base TypeScript interfaces/types

**Your Focus (Parallel):**
- [ ] Create Google Sheets template manually (5 sheets structure)
- [ ] Set up Google Cloud project + Sheets API credentials
- [ ] Create sample game data in Sheets for testing

**Deliverables:**
- Working React dev environment
- TypeScript types defined
- Google Sheets template ready
- Basic routing setup

---

### Phase 2: Decision Forms (Week 3-5)
**My Focus:**
- [ ] Build all 7 decision form components
- [ ] Implement form validation
- [ ] Create localStorage auto-save service

**Your Focus (Parallel):**
- [ ] Implement Google Sheets API integration
- [ ] Create read/write functions for Sheets
- [ ] Build admin panel (game creation, round setup)

**Deliverables:**
- All 7 decision forms working
- localStorage auto-save functional
- Google Sheets API connected
- Admin can create games/rounds in Sheets

---

### Phase 3: Integration (Week 6-7)
**My Focus:**
- [ ] Connect forms to Google Sheets API
- [ ] Implement submit flow (localStorage → Sheets)
- [ ] Build team authentication with login codes

**Your Focus (Parallel):**
- [ ] Create results display components
- [ ] Build P&L and Balance Sheet viewers
- [ ] Set up charts/graphs (Recharts)

**Deliverables:**
- Teams can submit decisions to Sheets
- Authentication working
- Results display components ready

---

### Phase 4: Calculations & Results (Week 8-10)
**My Focus:**
- [ ] Port PHP calculation formulas to TypeScript
- [ ] Implement round calculation engine
- [ ] Build admin "Calculate Round" functionality

**Your Focus (Parallel):**
- [ ] Create historical data viewer
- [ ] Build team rankings/comparison
- [ ] Polish UI/UX

**Deliverables:**
- Full calculation engine working
- Results displayed correctly
- Complete end-to-end flow functional

---

## Critical Files to Reference from Old System

**Calculation Formulas:**
- `d:\Bonopoly\game.php` (lines 411-600) - Core P&L/Balance Sheet calculations
- `d:\Bonopoly\function.php` - Helper calculation functions

**Data Structures:**
- `d:\Bonopoly\Sample database.sql` - Database schema (map to Google Sheets)

**Decision Input Logic:**
- `d:\Bonopoly\game.php` (lines 2486-2858) - Decision form handling
- `d:\Bonopoly\game.php` (lines 1300-2400) - Form validation rules

**Game Setup:**
- `d:\Bonopoly\game.php` (lines 729-1000) - Game creation logic

**Visualization:**
- `d:\Bonopoly\graph.php` - Chart generation (port to Recharts)

---

## TypeScript Interfaces (TO BE CREATED)

### Game Interface
```typescript
interface Game {
  id: string;
  name: string;
  noOfTeams: number; // max 5
  noOfRounds: number; // max 5, typically 3
  costEquation: string; // e.g., "0.9,6,-0.85,1.5"
  hrStandardWage: number;
  hrStandardTrainingBudget: number;
  depreciationRate: number;
  minCash: number;
  techAvailability: {
    us: string[];
    asia: string[];
    europe: string[];
  };
  createdAt: string;
}
```

### Round Interface
```typescript
interface Round {
  round: number; // 1-5
  deadline: string; // ISO datetime
  scenario: string;
  marketParams: {
    us: MarketParams;
    asia: MarketParams;
    europe: MarketParams;
  };
}

interface MarketParams {
  changeDemand: number;
  unitCostMaterial: number;
  labour: number;
  tax: number;
  interest: number;
  // ... other params
}
```

### Team Interface
```typescript
interface Team {
  id: string;
  name: string;
  loginCode: string; // unique code for team login
  members: string[]; // student names
  gameId: string;
}
```

### Decision Interface
```typescript
interface Decision {
  round: number;
  teamId: string;
  timestamp: string;
  submitted: boolean;
  production: ProductionDecision;
  hr: HRDecision;
  rnd: RnDDecision;
  investment: InvestmentDecision;
  logistics: LogisticsDecision;
  marketing: MarketingDecision;
  finance: FinanceDecision;
}

interface ProductionDecision {
  demandForecast: {
    us: { [tech: string]: number };
    asia: { [tech: string]: number };
    europe: { [tech: string]: number };
  };
  capacityAllocation: {
    us: { [tech: string]: number };
    asia: { [tech: string]: number };
  };
  suppliers: {
    [plantId: string]: string; // supplier selection
  };
  outsourcing: {
    [plantId: string]: number; // percentage
  };
}

interface HRDecision {
  employeeCount: number;
  monthlySalary: number;
  monthlyTrainingBudget: number;
}

interface RnDDecision {
  techInvestments: {
    tech1: number;
    tech2: number;
    tech3: number;
    tech4: number;
  };
  featureInvestments: {
    [feature: string]: number;
  };
  licensing: {
    [techOrFeature: string]: boolean;
  };
}

interface InvestmentDecision {
  newPlants: {
    us: number; // number of new plants
    asia: number;
  };
}

interface LogisticsDecision {
  deliveryPriority: {
    usPlants: string[]; // ['us', 'asia', 'europe'] in priority order
    asiaPlants: string[];
  };
}

interface MarketingDecision {
  products: {
    [tech: string]: {
      features: number; // number of features
      price: {
        us: number;
        asia: number;
        europe: number;
      };
      promotion: {
        us: number; // percentage
        asia: number;
        europe: number;
      };
    };
  };
}

interface FinanceDecision {
  transferPricing: {
    us: number; // multiplier 1-2
    asia: number;
    europe: number;
  };
  longtermDebt: number;
  shareIssuance: number;
  dividends: number;
}
```

### Output/Results Interface
```typescript
interface RoundResult {
  round: number;
  teamId: string;

  // P&L
  revenue: {
    us: number;
    asia: number;
    europe: number;
    total: number;
  };
  costs: {
    cogs: number;
    transportation: number;
    promotion: number;
    admin: number;
    rnd: number;
    total: number;
  };
  ebitda: number;
  depreciation: number;
  ebit: number;
  netFinancing: number;
  profitBeforeTax: number;
  incomeTax: number;
  profitAfterTax: number;

  // Balance Sheet
  assets: {
    fixedAssets: number;
    inventory: number;
    receivables: number;
    cash: number;
    total: number;
  };
  liabilities: {
    longtermLoans: number;
    shorttermLoans: number;
    payables: number;
    total: number;
  };
  equity: {
    shareCapital: number;
    retainedEarnings: number;
    profitForRound: number;
    total: number;
  };

  // Market Share
  marketShare: {
    us: { [tech: string]: number };
    asia: { [tech: string]: number };
    europe: { [tech: string]: number };
  };

  // Ratios
  roe: number; // Return on Equity
  ros: number; // Return on Sales
  eps: number; // Earnings per Share
  marketCap: number;
  sharePrice: number;

  // Operational
  hrEfficiency: number;
  hrTurnover: number;
  capacityUtilization: {
    us: number;
    asia: number;
  };
}
```

---

## Development Workflow

### When You Start Working:
1. Pull latest changes from repo (if using git)
2. Check HANDOFF.md for current status
3. Check TODO list in code
4. Update this file with what you're working on

### When You Finish Your Session:
1. Update HANDOFF.md with:
   - ✅ What you completed
   - 🔨 What's in progress
   - ⚠️ Any blockers or issues
   - 📝 Notes for next developer
2. Push your changes
3. Update TODO comments in code

### Communication Protocol:
- Update this file with clear status
- Use TODO/FIXME comments in code
- Document any decisions or changes
- Note any dependencies between tasks

---

## Current Session Notes

### Date: 2024-12-13
**Developer:** Claude Agent 1
**Working On:** Phase 1 - React project setup

**Completed:**
- [x] Created handoff documentation
- [ ] Setting up React + TypeScript project

**Next Steps for Other Developer:**
1. Create Google Sheets template with exact structure (5 sheets)
2. Set up Google Cloud project
3. Enable Google Sheets API
4. Create service account and download credentials JSON
5. Share the Sheets template with service account email

**Notes:**
- Using Vite for faster dev experience vs Create React App
- Material-UI chosen for UI components (rich table/form components)
- React Query for data fetching/caching
- Max 5 teams, max 5 rounds (typically 3 rounds)
- Non-real-time game (rounds last hours/days)

**✅ Completed in This Session:**
- [x] Created handoff documentation
- [x] Set up React + TypeScript + Vite project
- [x] Installed all dependencies (MUI, React Query, Recharts, etc.)
- [x] Created project folder structure
- [x] Created TypeScript type definitions (Game, Round, Team, Decision, Output)
- [x] Implemented localStorage service (deprecated - not needed)
- [x] Created README.md
- [x] **Analyzed original PHP/MySQL system** - 27 game params, 26 market params documented
- [x] **Created 9 Google Sheets template CSV files** ready for import
- [x] **Created sample JSON files** (decision and results examples)
- [x] **Wrote comprehensive import instructions** (IMPORT_INSTRUCTIONS.md)
- [x] **Documented complete template package** (README.md in templates folder)

**🔨 Currently Working On:**
- ✅ Updated handoff documentation

**⏳ Next Steps for YOU (User):**
1. ⭐ **PRIORITY**: Import Google Sheets templates following `google-sheets-templates/IMPORT_INSTRUCTIONS.md`
   - Create new Google Spreadsheet
   - Import all 9 CSV files (one per sheet)
   - Follow step-by-step instructions in IMPORT_INSTRUCTIONS.md
2. ⭐ Set up Google Cloud project + enable Sheets API
3. ⭐ Create service account + download JSON credentials
4. ⭐ Share spreadsheet with service account email
5. ⭐ Copy Spreadsheet ID and add to `.env` file

**⏳ Next Steps for Developer:**
1. Build `src/services/googleSheets.ts` - API wrapper for reading/writing Sheets
2. Implement team authentication with login codes
3. Create decision form components

**Project Location:**
- React app: `d:\Bonopoly\bonopoly-react\`
- Run with: `cd d:\Bonopoly\bonopoly-react && npm run dev`

**Blockers:**
- None! Foundation is ready

**Decisions Made:**
- ✅ Material-UI for UI
- ✅ Vite for build
- ⏳ Dark mode: Later
- ⏳ Mobile: Basic responsive

---

## Quick Start Commands (Once Setup)

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

---

## Google Sheets API Setup Instructions (For Other Developer)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Bonopoly Game"
3. Enable Google Sheets API
4. Create Service Account:
   - Go to IAM & Admin → Service Accounts
   - Create service account: "bonopoly-api"
   - Grant role: Editor
   - Create key (JSON) and download
5. Create Google Sheet:
   - Create new spreadsheet: "Bonopoly Game Template"
   - Create 5 sheets: Game_Config, Round_Assumptions, Teams, Team_Decisions, Round_Results
   - Share with service account email (from step 4)
   - Give "Editor" access
6. Note the Spreadsheet ID from URL:
   - `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
7. Add to `.env` file:
   ```
   VITE_GOOGLE_SHEETS_API_KEY=<your-api-key>
   VITE_SPREADSHEET_ID=<your-spreadsheet-id>
   ```

---

## Testing Strategy

### Unit Tests
- Calculation functions (most critical!)
- Validation logic
- Data transformations

### Integration Tests
- Google Sheets API calls
- localStorage operations
- Form submissions

### E2E Tests (Optional for MVP)
- Full game flow
- Multi-team simulation

---

## Deployment Plan (Future)

- **Frontend**: Vercel or Netlify (free tier)
- **Google Sheets**: Hosted on Google (free)
- **Domain**: Optional custom domain

**Total Cost**: $0 (using free tiers)

---

## Contact/Questions

If you have questions about:
- **Architecture decisions**: Check plan file at `C:\Users\Andy\.claude\plans\snappy-twirling-cookie.md`
- **PHP logic**: Reference original files in `d:\Bonopoly\`
- **Current status**: Check this HANDOFF.md file
- **Next steps**: See TODO list above

---

## Summary of Completed Work

### Phase 1: Foundation ✅ COMPLETE
**What was accomplished:**
1. **React Project Setup** - Full working dev environment with TypeScript + Vite + MUI
2. **TypeScript Interfaces** - Complete type definitions for all game entities
3. **Google Sheets Analysis** - Deep dive into original PHP system, documented all parameters
4. **Template Package** - 9 ready-to-import CSV files with comprehensive documentation

**Key Files Created:**
- `bonopoly-react/` - Full React application structure
- `google-sheets-templates/` - 9 CSV templates + instructions + samples
- `GAME_STRUCTURE_ANALYSIS.md` - Analysis of original PHP system
- `GOOGLE_SHEETS_FINAL_STRUCTURE.md` - Complete schema documentation
- `HANDOFF.md` - This coordination document

**Educational Complexity Preserved:**
✅ All 7 decision areas (Production, HR, R&D, Investment, Logistics, Marketing, Finance)
✅ All 26 market parameters per round per market
✅ 4 technologies with network coverage progression
✅ Complete financial calculations (P&L, Balance Sheet, Ratios)
✅ Competitive dynamics and market share calculation
✅ Temporal effects (investment lag, R&D lag)

**What's Different from Original:**
- ✅ CSV mystery strings → Named columns in Round_Market_Params
- ✅ PHP serialize() → JSON for decisions and results
- ✅ 20+ MySQL tables → 9 Google Sheets (better organized)
- ✅ Undocumented structure → Comprehensive documentation

**The Ball Is Now In Your Court:**
You need to import the templates into Google Sheets and set up API access before development can continue. Follow `google-sheets-templates/IMPORT_INSTRUCTIONS.md` for step-by-step guidance.

---

**Last Updated:** 2024-12-13 (Claude Agent 1)
**Status:** Phase 1 COMPLETE ✅ - Waiting for user to import Google Sheets templates
