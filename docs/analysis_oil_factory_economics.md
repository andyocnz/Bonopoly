# Oil & Energy Factory Cost Analysis
## Deep Economic Balance Review

---

## 1. Cross-Industry Comparison

### Factory Investment & Capacity

| Industry | Plant Cost (US) | Plant Cost (Asia) | Capacity/Plant | Cost per Unit Capacity |
|----------|----------------|-------------------|----------------|------------------------|
| **Electronics** | $30M | $18M | 900,000 units | $33.33 (US) / $20.00 (Asia) |
| **Oil & Energy** | $45M | $32M | 2,000,000 barrels | $22.50 (US) / $16.00 (Asia) |
| **Automotive** | $1,500M | $1,000M | 150,000 cars | $10,000 (US) / $6,667 (Asia) |

### Unit Economics (Per Product)

| Industry | Price Range | Unit Cost (COGS) | Gross Margin Potential | Revenue per Plant |
|----------|-------------|------------------|------------------------|-------------------|
| **Electronics** | $80 - $220 | $29 - $50 | $30 - $170 (38-77%) | $72M - $198M |
| **Oil & Energy** | $40 - $140 | $32 - $46 | $8 - $94 (20-67%) | $80M - $280M |
| **Automotive** | $25k - $80k | $20.5k - $28k | $4.5k - $52k (18-65%) | $3.75B - $12B |

---

## 2. Return on Investment (ROI) Analysis

### Payback Period (Best Case Scenario)

Assuming max price, optimal utilization (80%), and 50% gross margin:

**Electronics:**
- Plant cost: $30M (US)
- Annual capacity: 900,000 units
- Optimal production: 720,000 units (80%)
- Revenue @ $220: $158.4M
- Gross profit @ 50%: $79.2M
- **Payback: 4.5 months** ✓

**Oil & Energy:**
- Plant cost: $45M (US)
- Annual capacity: 2,000,000 barrels
- Optimal production: 1,600,000 barrels (80%)
- Revenue @ $140: $224M
- Gross profit @ 50%: $112M
- **Payback: 4.8 months** ✓

**Automotive:**
- Plant cost: $1,500M (US)
- Annual capacity: 150,000 cars
- Optimal production: 120,000 cars (80%)
- Revenue @ $80k: $9.6B
- Gross profit @ 50%: $4.8B
- **Payback: 3.75 months** ✓

### ⚠️ **Finding #1: All industries have unrealistically fast ROI**
In real world:
- Electronics factories: 3-5 years payback
- Oil refineries: 7-15 years payback
- Automotive plants: 5-10 years payback

---

## 3. Capital Intensity Ratios

### Plant Cost as % of Annual Revenue (at baseline prices)

**Electronics:**
- Plant: $30M
- Revenue @ $125/unit × 900k: $112.5M
- **Ratio: 26.7%** (2.7x annual revenue to build plant)

**Oil & Energy:**
- Plant: $45M
- Revenue @ $100/barrel × 2M: $200M
- **Ratio: 22.5%** (2.25x annual revenue to build plant)

**Automotive:**
- Plant: $1,500M
- Revenue @ $45k/car × 150k: $6.75B
- **Ratio: 22.2%** (2.22x annual revenue to build plant)

### ⚠️ **Finding #2: Oil is NOT out of balance vs other industries**
All three industries have similar capital intensity ratios (22-27% of annual revenue). This suggests the game is internally consistent.

---

## 4. Real-World Comparison: Oil Industry

### Real Oil Refinery Economics

**Small Refinery (50,000 bbl/day):**
- Construction cost: $2-3 billion
- Annual capacity: 18.25 million barrels/year
- Cost per barrel capacity: $109-164
- Typical payback: 10-15 years

**Medium Refinery (150,000 bbl/day):**
- Construction cost: $5-8 billion
- Annual capacity: 54.75 million barrels/year
- Cost per barrel capacity: $91-146
- Typical payback: 10-15 years

### Game vs Reality Gap

| Metric | Game (Oil) | Real World | Ratio |
|--------|-----------|------------|-------|
| Plant cost (US) | $45M | $2-8B | **1:44 to 1:178** |
| Cost per barrel capacity | $22.50 | $90-165 | **1:4 to 1:7** |
| Payback period | 4.8 months | 10-15 years | **1:25 to 1:38** |
| Gross margin | 20-67% | 5-15% | **4x to 13x** |

### ⚠️ **Finding #3: The game is COMPRESSED, not WRONG**
The entire game operates at 1-2% of real-world scale with 25-40x faster time compression.

---

## 5. Internal Game Balance Check

### Key Balance Metrics

**Starting Resources:**
- Electronics: 1 US plant × $30M = $30M in assets
- Oil: 1 US plant × $45M = $45M in assets (+50% vs Electronics)
- Automotive: 1 US plant × $1.5B = $1.5B in assets (+5000% vs Electronics)

**Starting Cash:**
- Electronics: (not specified, uses base)
- Oil: (not specified, uses base)
- Automotive: $250M (explicitly set)

### Cash-to-Asset Ratio

Need to check starting cash in base config...

**Problem Identified:**
- Automotive gets explicit `startingCash: 250_000_000`
- But its starting asset is $1.5B (plant)
- Cash-to-asset ratio: 16.7%

If Oil starts with default cash but a $45M plant, the ratio could be different.

---

## 6. The Real Issue: Time Scale Abstraction

### What does "capacity per plant" mean?

Looking at code comments:
```
// Capacity per plant (units per round)
capacityPerPlant: 325_000
```

**This is per ROUND, not per year!**

If a game has 8-12 rounds representing 2-3 years:
- Each round ≈ 3-4 months
- Oil plant: 2M barrels/round × 3 rounds/year = **6M barrels/year**
- Real refinery: 50k bbl/day × 365 days = **18.25M bbl/year**

So the game is running at roughly **1/3 real-world scale**, which is acceptable for a simulation.

---

## 7. What Numbers DON'T Look Right?

### Potential Issues:

**1. Oil unit costs too low relative to selling price:**
- Material: $22-26
- Labor: $6-10
- **Total COGS: $32-46**
- Selling price: $40-140
- **Margin: 20-67%**

Real oil industry margins: 5-15% in refining. The game allows 4-13x higher margins.

**2. Plant cost ratios:**
- Oil plant costs 1.5x Electronics ($45M vs $30M)
- But produces 2.2x capacity (2M vs 900k)
- **Cost efficiency: Oil is 47% MORE efficient than Electronics**

In reality, oil refineries are much MORE capital intensive per unit, not less.

**3. Price elasticity:**
Oil: { us: 1.1, asia: 1.4, europe: 1.2 }
Electronics: { us: 0.6, asia: 1.0, europe: 0.8 }

Oil is MORE price elastic than electronics?
Real world: Oil is a commodity (high elasticity ✓), but electronics has brand power (lower elasticity ✓).
**This is actually correct!**

---

## 8. Recommendations

### Option A: Keep Current Balance (Recommended)
**Rationale:**
- Game is internally consistent across industries
- All industries use ~20-25x time compression
- Capital intensity ratios are similar (22-27%)
- The game is meant to be playable in classroom settings, not a perfect simulation

**No changes needed.**

---

### Option B: Increase Realism (Trade-off: Slower Gameplay)

If you want to make Oil more realistic relative to the current scale:

**Adjusted Oil & Energy Config:**
```typescript
'Oil & Energy': {
  capacityPerPlant: 2_000_000,  // Keep same
  unitCosts: {
    directMaterialUS: 36,      // +10 (was 26)
    directMaterialAsia: 32,    // +10 (was 22)
    directLabourUS: 12,        // +2 (was 10)
    directLabourAsia: 8,       // +2 (was 6)
  },
  investment: {
    plantCostUS: 60_000_000,   // +33% (was 45M)
    plantCostAsia: 42_000_000, // +31% (was 32M)
  },
  priceDemand: {
    baselinePriceByRegion: { us: 110, asia: 105, europe: 120 }, // +10% (was 100/95/110)
    minPriceByRegion: { us: 50, asia: 45, europe: 55 },        // +25% (was 40/35/45)
    maxPriceByRegion: { us: 150, asia: 140, europe: 160 },     // +7% (was 140/130/150)
  },
}
```

**Impact:**
- Plant ROI increases from 4.8 to 6.4 months (still fast, but relatively slower)
- Gross margins compress from 20-67% to 15-50% (closer to real commodity business)
- Cost per barrel capacity: $30 (was $22.50) - closer to compressed real-world

---

### Option C: CORRECTED INTERPRETATION ✓

**The game might already be realistic - just for a SMALLER operation!**

Instead of a mega-refinery, this could represent:
1. **Small regional refinery** (10,000-20,000 bbl/day)
   - Real cost: $50-150M ✓
   - Annual throughput: 5M barrels ✓
   - Game: 2M/round × 3 rounds = 6M/year ✓ MATCHES!

2. **Fuel distribution terminal**
   - Real cost: $20-80M ✓
   - Handles 1-5M barrels/year ✓
   - Storage + blending + logistics

3. **Regional petroleum distributor**
   - Buys refined products, distributes to gas stations
   - Storage tanks, trucks, terminals
   - Cost: $30-100M ✓

**Game prices are ALREADY realistic:**
- Crude oil: $70-90/barrel (real)
- Gasoline: $100-140/barrel (real)
- Game: $40-140/barrel ✓ ACCURATE!

**Conclusion:** The game represents a regional-scale operation, not a mega-refinery. The $45M plant cost is actually REALISTIC for this interpretation!

---

## 9. Conclusion

**The numbers ARE internally consistent.** The issue is that the entire game operates at ~5% of real-world scale with massive time compression.

If you compare Oil to the real world in isolation, it looks wrong. But if you compare Oil to Electronics and Automotive within the game, it's balanced.

**Recommendation: No changes unless you want to adjust ALL industries proportionally.**

---

## 10. Questions to Resolve

1. **What is starting cash for Oil & Energy?**
   - Not specified in override, so uses base config
   - Need to verify this creates proper cash-to-asset ratio

2. **What's the intended game length?**
   - If 8 rounds = 2 years, then per-round numbers make more sense
   - If 8 rounds = 8 years, then everything is severely compressed

3. **Are profit margins intentionally high?**
   - Makes the game more forgiving for students
   - Allows for strategic mistakes without instant failure
   - Real-world margins would make the game brutally difficult

4. **Should Oil have different starting conditions?**
   - Higher starting cash due to higher plant cost?
   - Different starting factory count (2 plants vs 1)?

---

**Next Steps:**
Let me know which path you want to take, and I can help implement the changes while maintaining overall game balance.
