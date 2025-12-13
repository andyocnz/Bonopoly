# 📝 BONOPOLY 2026 - CHANGELOG

Track all major design decisions and changes here.

---

## 2024-12-13 - Design Phase Complete

### ✅ Analysis Completed
- Analyzed original PHP system (19,500 lines)
- Mapped all 76 auto-generated parameters
- Understood scenario-based market evolution
- Traced all financial calculations (P&L, Balance Sheet, Ratios)
- Discovered team name generation (fruit array)
- Understood temporal lags (investment 2-round, R&D 1-round)

### ✅ Architecture Designed
- **Database**: ONE Google Spreadsheet with 12 sheets
- **Data Format**: JSON compression for complex decisions/results
- **API Strategy**: Batch operations, smart caching
- **Product Design**: Product-agnostic configuration system

### ✅ Improvements Proposed
1. **Demand System**: Fixed market sizes vs capacity-based (APPROVED)
2. **Scenario System**: 10 realistic mixed-effect scenarios vs 8 uniform
3. **Market Share**: Improved competitive algorithm with consumer preferences
4. **Cost Equation**: Flagged for review (formula needs validation)

### ⚠️ Issues Fixed
- **CORRECTED**: Removed "late submit" status from workflow
  - Once round calculated → LOCKED forever
  - Only statuses: draft, submitted, locked

### 🎯 Ready for Implementation
- Phase 1: Prototype with phones (12-14 weeks)
- All design documents consolidated into MASTER_DESIGN_DOC.md

---

## Next Session (TBD)

### TODO:
- [ ] Review cost equation with real game data
- [ ] Find market share algorithm in original PHP
- [ ] Create Google Spreadsheet template
- [ ] Start React services implementation
- [ ] Set up Google Cloud project + Service Account

---

**How to use this file**: Add entry for every major decision or change made to the design.
