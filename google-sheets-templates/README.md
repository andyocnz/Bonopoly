# Bonopoly Google Sheets Templates

## 📦 What's in This Folder

This folder contains ready-to-import templates for setting up the Bonopoly business simulation game in Google Sheets.

### Template Files (9 CSV files):
1. **1_Game_Settings.csv** - Core game configuration (13 settings)
2. **2_Game_Parameters.csv** - Default parameters (HR, Finance, Inventory, R&D)
3. **3_Tech_Network_Coverage.csv** - Technology availability by round
4. **4_Round_Market_Params.csv** - Market conditions (26 parameters × 3 markets × rounds)
5. **5_Round_Schedule.csv** - Round deadlines and scenarios
6. **6_Teams.csv** - Team roster with login codes
7. **7_Team_Decisions.csv** - Empty (teams populate via React app)
8. **8_Round_Results.csv** - Empty (system calculates)
9. **9_Audit_Log.csv** - Empty (tracks changes)

### Sample Files:
- **sample_decision.json** - Example of team decision structure (all 7 areas)
- **sample_results.json** - Example of calculated results (P&L, Balance Sheet, etc.)

### Documentation:
- **IMPORT_INSTRUCTIONS.md** - Step-by-step guide to import into Google Sheets
- **README.md** - This file

---

## 🚀 Quick Start (3 Steps)

### Step 1: Create Google Spreadsheet
1. Go to [sheets.google.com](https://sheets.google.com)
2. Create new blank spreadsheet
3. Name it: "Bonopoly Game - [Your Course Name]"

### Step 2: Import Templates
1. For each CSV file (1 through 9):
   - Add new sheet (click "+" at bottom)
   - Rename sheet (remove the number, e.g., "Game_Settings")
   - File → Import → Upload the CSV
   - Choose "Replace current sheet"
2. Delete the default "Sheet1"

### Step 3: Configure
1. Edit **Game_Settings** with your game details
2. Edit **Round_Schedule** with your deadlines
3. Edit **Teams** with your student teams
4. Share with Google Service Account (for API access)

📖 **Full Instructions:** See `IMPORT_INSTRUCTIONS.md`

---

## 📊 What This Template Includes

### Full Feature Set:
✅ **7 Decision Areas** (Production, HR, R&D, Investment, Logistics, Marketing, Finance)
✅ **3 Markets** (US, Asia, Europe)
✅ **4 Technologies** (Tech 1-4 with infrastructure progression)
✅ **26 Market Parameters** per round per market
✅ **Complete Financial Calculations** (P&L, Balance Sheet, Ratios)
✅ **Competitive Dynamics** (Market share calculation)
✅ **Temporal Effects** (Investment 2-round lag, R&D 1-round lag)
✅ **Supplier Selection** (CSR impact on demand)

### Why This Structure?
- **University-grade simulation** - Teaches real business strategy
- **All complexity preserved** - Nothing simplified
- **Better organized** - Clear column names vs mystery CSV
- **JSON for decisions** - All 7 areas in one readable field
- **Draft vs Submitted** - Teams can edit until deadline

---

## 🎓 Educational Value

This simulation teaches students:
- **Strategic Decision Making** across 7 interconnected business functions
- **Financial Statement Analysis** (P&L, Balance Sheet, Cash Flow)
- **Competitive Strategy** (market share, pricing, positioning)
- **Resource Allocation** (capacity, HR, R&D budgets)
- **Risk Management** (debt/equity balance, inventory levels)
- **Temporal Planning** (investment lags, R&D delays)
- **Trade-offs** (cost vs quality, growth vs profitability)

---

## 📝 Typical Game Setup

**For a 3-Round Game:**
1. **Round 1** (48 hours): Teams learn interface, submit first decisions
2. **Round 2** (48 hours): Competitive dynamics emerge, strategic pivots
3. **Round 3** (48 hours): Final competition, winner determined

**Grading Based On:**
- Total Shareholder Return (TSR) - primary metric
- Strategic rationale (written report)
- Teamwork and decision process

---

## 🔧 For Developers

### Google Sheets API Integration:
1. Create Google Cloud project
2. Enable Google Sheets API
3. Create Service Account → Download JSON key
4. Share spreadsheet with service account email
5. Copy Spreadsheet ID from URL
6. Add to `.env`:
   ```
   VITE_SPREADSHEET_ID=your_id_here
   ```

### React App Integration:
- Read from Sheets 1-6 (game config, parameters, schedule)
- Write to Sheet 7 (Team_Decisions)
- Write to Sheet 8 (Round_Results after calculations)
- Optionally write to Sheet 9 (Audit_Log)

### Decision Flow:
1. Team logs in with `game_code` + `team_code`
2. React fetches their current decision from Sheet 7
3. Team edits in forms
4. Click "Save Draft" → Updates Sheet 7 with `status: "draft"`
5. Click "Submit Final" → Updates Sheet 7 with `status: "submitted"`
6. Forms lock (read-only)

---

## 📐 Data Structure

### Decision JSON (Sheet 7):
```json
{
  "production": {...},  // Demand forecast, capacity, suppliers, outsourcing
  "hr": {...},          // Employees, salary, training
  "rnd": {...},         // Tech development, features, licensing
  "investment": {...},  // New plants, upgrades
  "logistics": {...},   // Delivery priorities
  "marketing": {...},   // Features, pricing, promotion
  "finance": {...}      // Transfer pricing, debt, equity, dividends
}
```

### Results JSON (Sheet 8):
```json
{
  "pnl": {...},           // P&L statement
  "balanceSheet": {...},  // Assets, liabilities, equity
  "marketShare": {...},   // % by tech and market
  "ratios": {...},        // ROE, ROS, EPS, PE ratio, etc.
  "operational": {...},   // HR efficiency, capacity utilization
  "competitive": {...}    // Rank, TSR, comparisons
}
```

---

## 🎯 Key Features

### Game Configuration (Sheet 1):
- Max 5 teams per game
- Max 5 rounds (typically 3)
- Configurable deadlines
- Cost equation: `a,b,c,d` for cost multiplier formula
- Depreciation, min cash, initial capital

### Market Realism (Sheet 4):
- 26 different market parameters
- Different costs by market (US vs Asia vs Europe)
- Dynamic conditions per round (growth, tax, interest rates)
- Supplier costs (4 suppliers with different CSR ratings)

### Technology Progression (Sheet 3):
- Tech 1: Established (starts at 70-100% coverage)
- Tech 2: Growth phase (20% → 65% over rounds)
- Tech 3: Emerging (0% → launches mid-game)
- Tech 4: Future tech (0% → available late game)

No sales possible without network infrastructure!

---

## 🔒 Security & Integrity

### Access Control:
- **Instructors**: Full edit access to all sheets
- **Service Account**: Edit access for API (Sheets 7-9)
- **Students**: NO direct sheet access (use React app only)

### Data Integrity:
- Draft/Submitted status prevents accidental changes
- Timestamp on every save
- IP address tracking
- Audit log (optional)

### Fair Play:
- Calculations run server-side (students can't see formulas)
- Results locked after deadline
- All teams compete with same market conditions

---

## 📚 Additional Resources

### Documentation:
- **IMPORT_INSTRUCTIONS.md** - Detailed setup guide
- **GOOGLE_SHEETS_FINAL_STRUCTURE.md** - Complete schema reference
- **GAME_STRUCTURE_ANALYSIS.md** - Original PHP system analysis

### Sample Data:
- **sample_decision.json** - Complete decision example
- **sample_results.json** - Complete results example

### Code Templates:
- **../bonopoly-react/** - React application (in development)

---

## ❓ FAQs

**Q: Can I use this for online or in-person classes?**
A: Both! Teams can work remotely (each student from home) or together in classroom.

**Q: How many teams can play?**
A: Up to 5 teams per game instance. You can create multiple games for larger classes.

**Q: Can I customize the game parameters?**
A: YES! Edit Sheets 1-4 to adjust difficulty, market conditions, costs, etc.

**Q: What if students submit after deadline?**
A: System marks it as "late" - you decide penalty (or lock submissions at deadline).

**Q: Can teams see other teams' decisions?**
A: NO - only their own decisions and final results (market share, rankings).

**Q: How long does setup take?**
A: 15-20 minutes to import templates + 10 minutes to customize = ~30 minutes total.

**Q: Do I need coding skills?**
A: NO for basic setup (just import CSVs). YES for React app integration (or hire developer).

---

## 🎉 You're Ready!

Follow `IMPORT_INSTRUCTIONS.md` to get started.

**Questions?** Check the documentation or ask your developer.

**Good luck with your business simulation course!** 🚀📊
