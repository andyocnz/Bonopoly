# Bonopoly Developer Guide

Complete guide to understanding, configuring, and modifying the Bonopoly business simulation game.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Configuration Guide](#configuration-guide)
4. [Where to Edit What](#where-to-edit-what)
5. [Key Concepts](#key-concepts)
6. [Common Tasks](#common-tasks)
7. [Performance Optimizations](#performance-optimizations)

---

## Architecture Overview

### Tech Stack

**Frontend:**
- React 19.2 + TypeScript
- React Router for navigation
- Recharts for data visualization
- Vite for bundling (with code splitting)

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL database

**Key Features:**
- Role-based authentication (Team, Educator, Admin)
- Real-time game simulation engine
- AI opponents with configurable difficulty
- Multi-round competitive gameplay
- Financial reporting and analytics

### Application Flow

```
Landing Page → Team Login/Demo → Mission Brief → Decisions → Results
                                      ↓
                                 [Game Engine]
                                      ↓
                        Financial Calculations & AI Moves
```

**Admin/Educator Flow:**
```
Admin Login → Create Game → Monitor Progress → View All Results
```

---

## Project Structure

```
bonopoly-react2/
├── public/              # Static assets
│   └── landing.html     # Marketing landing page (static HTML)
├── src/
│   ├── api/             # API client layer
│   │   └── client.ts    # API endpoints (gameApi, teamApi, etc.)
│   ├── components/      # Reusable React components
│   │   ├── FinancialReport.tsx
│   │   ├── DecisionSimulator.tsx
│   │   └── LoadingSpinner.tsx
│   ├── context/         # React context providers
│   │   ├── GameContext.tsx      # Game/team state management
│   │   └── ThemeContext.tsx     # Dark/light mode
│   ├── engine/          # Game simulation engine
│   │   ├── gameEngine.ts        # Core calculations (CRITICAL)
│   │   ├── aiEngine.ts          # AI opponent logic
│   │   ├── strategyEngine.ts    # Strategy patterns
│   │   └── scenarios.json       # Market scenarios config
│   ├── hooks/           # Custom React hooks
│   │   └── useReviewData.ts     # Results data formatting
│   ├── pages/           # Page components
│   │   ├── LandingPage.tsx      # Redirects to landing.html
│   │   ├── TeamLoginPage.tsx
│   │   ├── MissionModernPage.tsx
│   │   ├── DecisionsModernPage.tsx
│   │   ├── ResultsModernPage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── DemoGamePage.tsx     # Auto-demo creation
│   │   └── StrategySimulatorPage.tsx
│   ├── server/          # Backend Express server
│   │   ├── index.ts     # Server entry point
│   │   └── routes/      # API route handlers
│   │       ├── games.ts # Game CRUD & advance logic
│   │       ├── teams.ts # Team login & decisions
│   │       └── admin.ts # Admin operations
│   ├── styles/          # CSS files
│   ├── types/           # TypeScript types
│   └── utils/           # Helper functions
├── prisma/
│   └── schema.prisma    # Database schema
├── demo-config.json     # Demo game configuration
├── vite.config.ts       # Vite build config
└── package.json         # Dependencies & scripts
```

---

## Configuration Guide

### 1. Game Configuration (`src/engine/gameEngine.ts`)

**Location:** Lines 35-100 in `gameEngine.ts`

```typescript
export const GAME_CONFIG = {
  capacityPerPlant: 200000,      // Production capacity per factory
  initialCash: 2000000,           // Starting cash
  initialSharePrice: 10,          // Starting stock price
  sharesOutstanding: 1000000,     // Total shares

  regions: {
    US: { demandBase: 350000 },
    Asia: { demandBase: 250000 },
    Europe: { demandBase: 150000 }
  },

  investment: {
    plantCostUS: 1000000,        // Factory cost in US
    plantCostAsia: 800000,       // Factory cost in Asia
  },

  financial: {
    interestRate: 0.06,          // Loan interest (6%)
    taxRate: 0.30,               // Corporate tax (30%)
  },

  // ... more config options
}
```

**What to Edit:**
- **Starting conditions:** `initialCash`, `initialSharePrice`
- **Production limits:** `capacityPerPlant`
- **Market size:** `regions.*.demandBase`
- **Costs:** `investment.*`, `financial.*`

### 2. Demo Game Configuration (`demo-config.json`)

```json
{
  "demoGame": {
    "enabled": true,
    "rounds": 3,
    "industry": "automotive",
    "humanTeamCount": 1,
    "aiTeamCount": 3,
    "aiDifficulty": "random",
    "teamNames": ["APEX Motors", "Rival Corp A", "Rival Corp B", "Rival Corp C"],
    "autoAdvance": true
  }
}
```

**What to Edit:**
- `rounds`: Number of rounds in demo
- `industry`: "automotive", "electronics", "oil"
- `aiTeamCount`: Number of AI opponents
- `teamNames`: Team name list

### 3. Market Scenarios (`src/engine/scenarios.json`)

```json
{
  "1": {
    "id": 1,
    "name": "Economic Boom",
    "description": "Strong demand across all markets",
    "effects": {
      "demandMultiplier": 1.2,
      "priceElasticity": 0.8
    }
  }
}
```

**What to Edit:**
- Add new scenarios by adding numbered entries
- Modify `effects` to change market conditions

### 4. Build Configuration (`vite.config.ts`)

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'game-engine': ['./src/engine/gameEngine'],
          // Add more chunks here
        }
      }
    },
    chunkSizeWarningLimit: 500
  }
})
```

**What to Edit:**
- `manualChunks`: Split code into separate bundles
- `chunkSizeWarningLimit`: Adjust bundle size warnings

---

## Where to Edit What

### Adding a New Decision Input

**Files to modify:**
1. `src/pages/DecisionsModernPage.tsx` - Add UI input field
2. `src/engine/gameEngine.ts` - Update decision type & calculation
3. `prisma/schema.prisma` - Add database field if needed
4. `src/server/routes/teams.ts` - Update submission validation

**Example:** Adding "Training Budget"
```typescript
// 1. DecisionsModernPage.tsx (around line 800)
<input
  type="number"
  value={decisions.training || 0}
  onChange={(e) => setDecisions({...decisions, training: +e.target.value})}
/>

// 2. gameEngine.ts (in calculateRound function)
const trainingEffect = decisions.training > 100000 ? 1.05 : 1.0
const adjustedProductivity = baseProductivity * trainingEffect

// 3. schema.prisma (in TeamDecisions model)
training     Int?

// 4. teams.ts (in POST /api/teams/:id/decisions)
const { training, ...other } = req.body
// Add validation for training
```

### Changing Financial Calculations

**Primary location:** `src/engine/gameEngine.ts`

**Key functions:**
- `calculateRound()` - Main simulation logic (line ~500)
- `calculateFinancials()` - P&L calculations (line ~1200)
- `calculateBalanceSheet()` - Balance sheet (line ~1400)

**Example:** Change depreciation rate
```typescript
// gameEngine.ts, line ~1230
const depreciation = fixedAssets * 0.10  // Change from 0.10 to desired rate
```

### Modifying AI Behavior

**File:** `src/engine/aiEngine.ts`

**Function:** `generateAIDecisions()`

```typescript
export function generateAIDecisions(difficulty: 'easy' | 'medium' | 'hard') {
  const aggression = difficulty === 'hard' ? 1.2 :
                     difficulty === 'medium' ? 1.0 : 0.8

  return {
    price: basePrice * aggression,
    production: baseProduction * aggression,
    // ... more decisions
  }
}
```

### Adding a New Page/Route

**Steps:**
1. Create page component in `src/pages/`
2. Add lazy import in `src/App.tsx`
3. Add route in `src/App.tsx`
4. Add navigation links

**Example:**
```typescript
// 1. Create src/pages/NewPage.tsx
export function NewPage() {
  return <div>New Page</div>
}

// 2. App.tsx - Add lazy import
const NewPage = lazy(() => import('./pages/NewPage').then(m => ({ default: m.NewPage })))

// 3. App.tsx - Add route
<Route path="/new-page" element={<NewPage />} />

// 4. Add link in navigation
<button onClick={() => navigate('/new-page')}>New Page</button>
```

### Changing Database Schema

**File:** `prisma/schema.prisma`

**Steps:**
```bash
# 1. Edit schema.prisma
# 2. Create migration
npm run db:migrate

# 3. Migration will be created in prisma/migrations/
```

**Example:** Add field to Game model
```prisma
model Game {
  id          String   @id @default(uuid())
  name        String
  newField    String?  // Add this
  // ... other fields
}
```

---

## Key Concepts

### 1. Game Flow

```
Round Start → All Teams Submit Decisions → Admin Clicks "Advance"
                                              ↓
                                        Game Engine Runs
                                              ↓
                                  Calculates Results for All Teams
                                              ↓
                                    Results Saved to Database
                                              ↓
                                    Teams View Results
```

### 2. State Management

**Game Context** (`src/context/GameContext.tsx`):
- Stores current game and team
- Provides authentication state
- Available via `useGame()` hook

```typescript
const { game, team, setGame, setTeam, logout } = useGame()
```

### 3. API Structure

**Client:** `src/api/client.ts`
```typescript
export const gameApi = {
  create: (data) => POST('/api/games', data),
  get: (id) => GET(`/api/games/${id}`),
  advance: (id) => POST(`/api/games/${id}/advance`)
}

export const teamApi = {
  login: (code, pin) => POST('/api/teams/login', { code, pin }),
  submitDecisions: (id, decisions) => POST(`/api/teams/${id}/decisions`, decisions)
}
```

**Server Routes:**
- `src/server/routes/games.ts` - Game operations
- `src/server/routes/teams.ts` - Team operations
- `src/server/routes/admin.ts` - Admin operations

### 4. Demo Mode

**File:** `src/pages/DemoGamePage.tsx`

**Features:**
- Auto-creates game with AI opponents
- Stores credentials in `localStorage.demoGameCredentials`
- Reuses same demo game on return visits
- Auto-advances rounds when human submits

**Clear demo:** `localStorage.removeItem('demoGameCredentials')`

---

## Common Tasks

### 1. Add a New Industry

**Files to edit:**
1. `src/engine/gameEngine.ts` - Add industry config
2. `src/utils/regionLabels.ts` - Add region names
3. `prisma/schema.prisma` - Update Industry enum

```typescript
// gameEngine.ts
export const INDUSTRY_CONFIGS = {
  automotive: { /* existing */ },
  pharma: {  // New industry
    capacityPerPlant: 100000,
    productName: "Medication Units",
    regions: {
      US: { name: "North America", demandBase: 200000 },
      Asia: { name: "Asia Pacific", demandBase: 300000 },
      Europe: { name: "Europe", demandBase: 250000 }
    }
  }
}
```

### 2. Change Round Duration

**File:** `src/pages/CreateGamePage.tsx`

```typescript
// Line ~100
<select value={hoursPerRound} onChange={(e) => setHoursPerRound(+e.target.value)}>
  <option value="24">24 hours</option>
  <option value="48">48 hours</option>
  <option value="72">72 hours</option>  // Add new option
</select>
```

### 3. Modify Results Display

**File:** `src/pages/ResultsModernPage.tsx`

**Key sections:**
- Line 1360: Leaderboard/podium
- Line 1460: Financial summary cards
- Line 1600: Regional performance table
- Line 2000+: Charts and visualizations

### 4. Adjust AI Difficulty

**File:** `src/engine/aiEngine.ts`

```typescript
const DIFFICULTY_SETTINGS = {
  easy: { aggression: 0.7, riskTolerance: 0.3 },
  medium: { aggression: 1.0, riskTolerance: 0.5 },
  hard: { aggression: 1.3, riskTolerance: 0.8 }
}
```

---

## Performance Optimizations

### Current Optimizations (Jan 2026)

**Bundle Size:**
- Initial load: ~289KB (82% reduction from 1.6MB)
- Code splitting enabled for all routes
- Vendor chunks separated (React, recharts, etc.)
- Admin pages lazy-loaded only when needed

**Configuration:** `vite.config.ts`
```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-charts': ['recharts'],
  'game-engine': ['./src/engine/gameEngine'],
  'admin': ['./src/pages/AdminPage', /* ... */],
  'components-heavy': ['./src/components/FinancialReport', /* ... */]
}
```

**Best Practices:**
- Use lazy loading for all route components
- Keep game engine in separate chunk
- Split heavy libraries (charts) from core bundle
- Monitor bundle size with `npm run build`

---

## Troubleshooting

### Build Errors

**TypeScript errors:**
```bash
npm run build  # Shows all TS errors
```

**Fix unused variables:**
```typescript
// Prefix with underscore
const _unusedVar = something
```

### Database Issues

**Reset database:**
```bash
npx prisma migrate reset  # WARNING: Deletes all data
npm run db:migrate
```

**View data:**
```bash
npm run db:studio  # Opens Prisma Studio
```

### Demo Game Issues

**Clear stored demo:**
```javascript
// In browser console:
localStorage.removeItem('demoGameCredentials')
```

**Check demo config:**
- File: `demo-config.json`
- Ensure `enabled: true`

---

## Quick Reference

### Important Files

| File | Purpose |
|------|---------|
| `src/engine/gameEngine.ts` | Core game calculations |
| `src/api/client.ts` | API client functions |
| `src/context/GameContext.tsx` | Global game state |
| `demo-config.json` | Demo game settings |
| `prisma/schema.prisma` | Database schema |
| `vite.config.ts` | Build configuration |

### npm Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:all` | Run frontend + backend |
| `npm run build` | Production build |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open database UI |

### Environment Variables

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/bonopoly"
SESSION_SECRET="your-secret-key"
PORT=3001
```

---

## Getting Help

**Common issues:**
1. Build fails → Check TypeScript errors
2. Database errors → Verify DATABASE_URL in `.env`
3. Demo not working → Check `demo-config.json` and clear localStorage
4. Results not refreshing → Check browser console for API errors

**Developer tools:**
- React DevTools (browser extension)
- Prisma Studio (`npm run db:studio`)
- Browser console for client errors
- Server logs for backend errors

---

*Last updated: January 2026*
*Current version: Bonopoly UAT v1.0*
