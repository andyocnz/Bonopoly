# How to Import Bonopoly Templates into Google Sheets

## Quick Start (5 minutes)

### Step 1: Create New Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Click **"+ Blank"** to create new spreadsheet
3. Rename it to: **"Bonopoly Game - Fall 2024"** (or your game name)

### Step 2: Import Each Sheet
You'll import 9 CSV files as separate sheets:

#### For Each CSV File:
1. **Bottom left** → Click **"+"** (Add sheet) button
2. Right-click the new sheet tab → **"Rename"**
3. Name it exactly as the CSV filename (without .csv):
   - `Game_Settings`
   - `Game_Parameters`
   - `Tech_Network_Coverage`
   - `Round_Market_Params`
   - `Round_Schedule`
   - `Teams`
   - `Team_Decisions`
   - `Round_Results`
   - `Audit_Log`

4. **File** → **Import** → **Upload**
5. Select the corresponding CSV file
6. Import settings:
   - **Import location**: Replace current sheet
   - **Separator type**: Comma
   - **Convert text to numbers**: YES
7. Click **"Import data"**

### Step 3: Delete Default Sheet
- Right-click **"Sheet1"** → **Delete**

---

## Detailed Import Guide

### Sheet 1: Game_Settings
**File:** `1_Game_Settings.csv`

**After Import:**
- Freeze row 1 (View → Freeze → 1 row)
- Format column B (Value) as **Plain text** (Format → Number → Plain text)
- Bold row 1 header

**What It Contains:**
- 13 game configuration settings
- Edit the `Value` column to customize your game

### Sheet 2: Game_Parameters
**File:** `2_Game_Parameters.csv`

**After Import:**
- Freeze row 1
- Format column C (Value) as **Number**

**What It Contains:**
- 9 default parameters (HR, Finance, Inventory, R&D)
- Rarely needs editing

### Sheet 3: Tech_Network_Coverage
**File:** `3_Tech_Network_Coverage.csv`

**After Import:**
- Freeze row 1
- Format columns C-F (Tech1-4) as **Percentage** (Format → Number → Percent)
- Add color coding:
  - 0% = Red
  - 1-50% = Yellow
  - 51-99% = Light green
  - 100% = Dark green

**What It Contains:**
- Technology infrastructure availability by round
- Shows which technologies are viable in each market each round

### Sheet 4: Round_Market_Params
**File:** `4_Round_Market_Params.csv`

⚠️ **IMPORTANT**: This is the LARGEST sheet (26 columns!)

**After Import:**
- Freeze rows 1 AND columns A-B (View → Freeze → Up to row 1 and Up to column B)
- Format all numeric columns as **Number** with 2 decimal places
- Add alternating row colors for readability
- Consider hiding unused rounds (rows for rounds 4-5 if only doing 3 rounds)

**What It Contains:**
- All market parameters for each round:
  - Demand multipliers
  - Cost factors (material, labour, suppliers)
  - Tax and interest rates
  - Tech and feature costs
  - Transportation and tariffs

**To Add More Rounds:**
- Copy row 2 (US) and paste 3 rows below
- Copy row 3 (Asia) and paste 3 rows below
- Copy row 4 (Europe) and paste 3 rows below
- Update Round column to 4, 4, 4
- Adjust values based on scenario

### Sheet 5: Round_Schedule
**File:** `5_Round_Schedule.csv`

**After Import:**
- Freeze row 1
- Format column C (Deadline) as **Date time** (Format → Number → Date time)
- Add conditional formatting for Status:
  - "active" = Green background
  - "pending" = Yellow background
  - "completed" = Gray background

**What It Contains:**
- Round numbers and deadlines
- Scenario codes
- Status tracking

**To Set Deadlines:**
1. Edit the `Deadline` column with your actual dates/times
2. Example: `2024-12-15 17:00:00` = December 15, 2024 at 5:00 PM

### Sheet 6: Teams
**File:** `6_Teams.csv`

**After Import:**
- Freeze row 1
- Format column C (login_code) as **Plain text** (important!)
- Bold row 1

**What It Contains:**
- 5 sample teams (edit with your actual student teams)

**To Customize:**
1. Edit `team_name` to your team names
2. Edit `login_code` to unique codes (recommend 8-10 characters)
3. Edit `members` with actual student names
4. Edit `email` with team email addresses

**Login Code Tips:**
- Use uppercase for clarity
- Avoid ambiguous characters (O vs 0, l vs 1)
- Make them memorable but unique
- Examples: ALPHA2024, BRAVO24, CHARLIE2024

### Sheet 7: Team_Decisions ⭐
**File:** `7_Team_Decisions.csv`

**After Import:**
- Freeze row 1
- Format column C (timestamp) as **Date time**
- Format column E (decisions_json) as **Plain text** (VERY IMPORTANT!)
- Set column E width to 100+ (to see JSON)

**What It Contains:**
- EMPTY (teams will populate this as they submit decisions)
- This is where ALL team decisions are stored as JSON

**Structure:**
Each team submission creates ONE row:
- `round`: Which round (1-5)
- `team_id`: team1, team2, etc.
- `timestamp`: When saved
- `status`: "draft" or "submitted"
- `decisions_json`: **HUGE JSON** with all 7 decision areas
- `submitted_by`: Email of person who submitted
- `ip_address`: For audit trail

**Example Row:**
```
1 | team1 | 2024-12-15 16:45:00 | submitted | {"production":{...},"hr":{...},...} | john@example.com | 192.168.1.100
```

See `sample_decision.json` for the full structure!

### Sheet 8: Round_Results
**File:** `8_Round_Results.csv`

**After Import:**
- Freeze row 1
- Format column C (calculated_at) as **Date time**
- Format column D (results_json) as **Plain text**
- Set column D width to 100+

**What It Contains:**
- EMPTY (system populates after calculating results)
- Stores P&L, Balance Sheet, Market Share, Ratios

**Structure:**
One row per team per round after admin clicks "Calculate Round"

See `sample_results.json` for the full structure!

### Sheet 9: Audit_Log
**File:** `9_Audit_Log.csv`

**After Import:**
- Freeze row 1
- Format column A (timestamp) as **Date time**

**What It Contains:**
- EMPTY (tracks all changes)
- Optional but recommended for transparency

---

## Final Steps

### 1. Share the Spreadsheet
- Click **"Share"** button (top right)
- Add your co-instructors as **Editors**
- Get shareable link for students (they'll use React app, not direct access)

### 2. Get Spreadsheet ID
The ID is in the URL:
```
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
```
Copy the `SPREADSHEET_ID` part (long random string)

**Example:**
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                      This is your SPREADSHEET_ID
```

### 3. Save the Spreadsheet ID
You'll need this for:
- `.env` file in React app
- Google Sheets API configuration

---

## Google Sheets API Setup (For Developer)

### Enable Google Sheets API:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project: "Bonopoly Game"
3. Enable **Google Sheets API**
4. Create **Service Account**:
   - Name: "bonopoly-api"
   - Role: Editor
   - Create JSON key → Download

5. **Share spreadsheet with service account:**
   - Copy service account email (from JSON: `client_email`)
   - Example: `bonopoly-api@bonopoly-game.iam.gserviceaccount.com`
   - In Google Sheets, click **Share**
   - Paste service account email
   - Grant **Editor** access
   - Uncheck "Notify people"
   - Click **Share**

### Add to .env File:
```
VITE_SPREADSHEET_ID=your_spreadsheet_id_here
VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL=bonopoly-api@...iam.gserviceaccount.com
```

Put the downloaded JSON key file in:
```
bonopoly-react/credentials/google-sheets-service-account.json
```

---

## Verification Checklist

After importing, verify:

- [ ] All 9 sheets created and named correctly
- [ ] Sheet1 (default) deleted
- [ ] Row 1 frozen on all sheets
- [ ] Columns formatted correctly (numbers, dates, text)
- [ ] Game_Settings values updated for your game
- [ ] Round_Schedule deadlines set
- [ ] Teams customized with your students
- [ ] Spreadsheet shared with service account email
- [ ] Spreadsheet ID copied to `.env` file

---

## Tips & Tricks

### Color Coding (Optional but Helpful):
- **Game_Settings**: Light blue header
- **Round_Market_Params**: Light green (it's huge!)
- **Team_Decisions**: Light yellow (most active)
- **Round_Results**: Light purple

### Protection (Recommended):
1. Protect sheets 1-6 (config sheets)
   - Select sheet → Data → Protect sheets and ranges
   - Only allow instructors to edit
2. Keep sheets 7-9 unprotected (for app to write)

### Backup:
- File → Make a copy (before each game session)
- Or use Google Sheets version history

---

## Troubleshooting

**Q: Import says "No data found"**
- Check CSV file encoding is UTF-8
- Try opening CSV in Notepad first to verify

**Q: Numbers showing as text**
- Select column → Format → Number → Number

**Q: Dates not recognized**
- Use format: `YYYY-MM-DD HH:MM:SS`
- Example: `2024-12-15 17:00:00`

**Q: JSON appears as formula**
- Format column as **Plain text** BEFORE pasting JSON
- If already pasted, add apostrophe ' before JSON

**Q: Can't find Spreadsheet ID**
- It's the long string in the URL between `/d/` and `/edit`

---

## Need Help?

- Check `GOOGLE_SHEETS_FINAL_STRUCTURE.md` for detailed schema
- Check `sample_decision.json` for decision structure
- Check `sample_results.json` for results structure
- Ask your developer for API integration help

---

**Estimated Time:** 15-20 minutes for first-time setup

**Result:** Professional business simulation database ready for React app! 🎉
