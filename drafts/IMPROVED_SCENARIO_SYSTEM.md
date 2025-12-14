# Improved Scenario System - Realistic Economic Dynamics

## Current System Analysis

### What Works Well ✅
1. **Simple execution**: Pick random scenario, apply % changes, compound over rounds
2. **Unpredictable**: Different markets can be in different economic phases
3. **Compounding effects**: Realistic accumulation (1.15 × 1.10 = 1.265)
4. **Educational**: Students learn to adapt to changing conditions

### Problems with Current System ❌
1. **Uniform changes**: All 29 parameters change by same % (unrealistic)
   - Example: Scenario 1 = "+10% everything" (demand, costs, taxes, ALL)
   - Reality: Boom increases demand BUT also increases costs differently
2. **Limited scenarios**: Only 8 scenarios, mostly uniform multipliers
3. **No mixed effects**: Real economies have nuanced impacts
4. **Missing consumer behavior**: No preference shifts based on economic conditions

---

## PROPOSED IMPROVED SYSTEM

### Philosophy
**Keep the elegant mechanism (random scenario → % changes → compound), but make scenarios realistic with mixed effects**

### New Scenario Structure

```typescript
interface ImprovedScenario {
  id: number
  name: string
  description: string
  narrative: string  // Story for students

  // Demand effects (by market type)
  demandEffects: {
    overall: number          // Base demand change %
    priceElasticity: number  // How price-sensitive consumers are
    qualityPreference: number // How much they value features
  }

  // Cost effects (differential impacts)
  costEffects: {
    materials: number        // Raw material cost change %
    labour: number           // Labour cost change %
    energy: number           // Energy/utilities change %
    logistics: number        // Transportation cost change %
    outsourcing: number      // Outsource cost change %
  }

  // Market structure effects
  marketEffects: {
    taxRate: number          // Absolute change (e.g., +5% → 30% becomes 35%)
    interestRate: number     // Absolute change in percentage points
    exchangeRate: number     // % change in currency value
    tariffs: number          // % change in tariff rates
  }

  // Technology effects
  techEffects: {
    rndCostChange: number    // R&D cost change %
    tech1Attractiveness: number
    tech2Attractiveness: number
    tech3Attractiveness: number
    tech4Attractiveness: number
  }

  // Consumer preferences (NEW!)
  consumerPreferences: {
    qualityWeight: number    // Multiplier for quality in market share calc
    priceWeight: number      // Multiplier for price sensitivity
    brandLoyalty: number     // How sticky is market share?
  }
}
```

---

## 10 Realistic Scenarios (Replaces Original 8)

### Scenario 1: Economic Boom 🚀
```typescript
{
  id: 1,
  name: "Economic Boom",
  description: "Strong GDP growth, low unemployment, high consumer confidence",
  narrative: "The economy is firing on all cylinders. GDP growth hits 5.5%, unemployment drops to 3.2%, and consumer spending surges. However, tight labor markets drive up wages, and supply chains struggle to keep pace.",

  demandEffects: {
    overall: +20,              // +20% demand
    priceElasticity: 0.7,      // Less price-sensitive (willing to pay)
    qualityPreference: 1.3     // Want premium products
  },

  costEffects: {
    materials: +8,             // Material costs up (supply chains tight)
    labour: +15,               // Wages rising fast (tight labor market)
    energy: +12,               // Energy demand high
    logistics: +10,            // Shipping costs up
    outsourcing: +5            // Less outsourcing available
  },

  marketEffects: {
    taxRate: 0,                // Tax unchanged
    interestRate: +2,          // Central bank raises rates to cool economy
    exchangeRate: +5,          // Currency appreciates (strong economy)
    tariffs: 0                 // Tariffs unchanged
  },

  techEffects: {
    rndCostChange: +10,        // R&D talent expensive
    tech1Attractiveness: 0.9,  // Old tech less desired
    tech2Attractiveness: 1.1,
    tech3Attractiveness: 1.3,
    tech4Attractiveness: 1.5   // Premium tech very attractive
  },

  consumerPreferences: {
    qualityWeight: 1.4,        // Quality matters more
    priceWeight: 0.7,          // Price matters less
    brandLoyalty: 0.9          // Willing to try new brands
  }
}
```

**Business Implications**:
- High revenue opportunity (+20% demand)
- But costs rising faster than revenue
- Should you raise prices? Invest in premium tech?
- Margin squeeze vs volume growth tradeoff

---

### Scenario 2: Recession 📉
```typescript
{
  id: 2,
  name: "Recession",
  description: "Negative GDP growth, rising unemployment, consumers cutting back",
  narrative: "GDP contracts 2.5%, unemployment jumps to 8%, and consumer confidence plummets. Shoppers delay purchases and hunt for bargains. However, input costs fall as commodity prices crash.",

  demandEffects: {
    overall: -25,              // -25% demand (harsh!)
    priceElasticity: 1.8,      // VERY price-sensitive
    qualityPreference: 0.6     // Features don't matter, survival matters
  },

  costEffects: {
    materials: -15,            // Commodity prices crash
    labour: -8,                // Unemployment → cheaper wages
    energy: -20,               // Energy prices collapse
    logistics: -12,            // Shipping capacity surplus
    outsourcing: -10           // Plenty of outsource capacity
  },

  marketEffects: {
    taxRate: -3,               // Government stimulus (tax cuts)
    interestRate: -4,          // Central bank slashes rates
    exchangeRate: -10,         // Currency depreciates
    tariffs: -5                // Trade barriers lowered to boost economy
  },

  techEffects: {
    rndCostChange: -5,         // Less competition for talent
    tech1Attractiveness: 1.2,  // Budget products attractive
    tech2Attractiveness: 1.0,
    tech3Attractiveness: 0.7,
    tech4Attractiveness: 0.5   // Luxury tech avoided
  },

  consumerPreferences: {
    qualityWeight: 0.6,        // Quality less important
    priceWeight: 1.8,          // Price VERY important
    brandLoyalty: 0.7          // Will switch for better price
  }
}
```

**Business Implications**:
- Revenue collapse (-25% demand)
- But costs also falling
- Should you cut prices aggressively? Focus on Tech 1?
- Cash preservation vs market share battle

---

### Scenario 3: Stagflation 😰
```typescript
{
  id: 3,
  name: "Stagflation",
  description: "No growth but high inflation - worst of both worlds",
  narrative: "GDP growth stagnates at 0.5%, yet inflation surges to 9%. Consumers have no more money, but everything costs more. Supply shocks drive material costs through the roof while demand stays flat.",

  demandEffects: {
    overall: -5,               // Slight demand drop
    priceElasticity: 1.5,      // Price-sensitive (inflation hurts)
    qualityPreference: 0.8
  },

  costEffects: {
    materials: +25,            // Material costs SKYROCKET (supply shock)
    labour: +18,               // Wages rise to match inflation
    energy: +35,               // Energy crisis
    logistics: +20,            // Fuel costs soar
    outsourcing: +12
  },

  marketEffects: {
    taxRate: +3,               // Government needs revenue
    interestRate: +6,          // Fighting inflation aggressively
    exchangeRate: -15,         // Currency weak
    tariffs: +8                // Protectionism rises
  },

  techEffects: {
    rndCostChange: +20,        // R&D very expensive
    tech1Attractiveness: 1.1,
    tech2Attractiveness: 0.9,
    tech3Attractiveness: 0.7,
    tech4Attractiveness: 0.5
  },

  consumerPreferences: {
    qualityWeight: 0.7,
    priceWeight: 1.6,
    brandLoyalty: 0.6
  }
}
```

**Business Implications**:
- NIGHTMARE scenario: Flat demand, soaring costs
- Margin compression extreme
- Should you raise prices and lose volume? Or hold prices and lose profit?
- Cash flow crisis likely

---

### Scenario 4: Tech Disruption 💡
```typescript
{
  id: 4,
  name: "Technology Disruption",
  description: "New technology wave creates excitement and demand surge",
  narrative: "A breakthrough technology launches, creating massive consumer excitement. Early adopters rush to buy premium products with cutting-edge features. Tech talent is in huge demand.",

  demandEffects: {
    overall: +30,              // Huge demand surge
    priceElasticity: 0.5,      // Willing to pay premium
    qualityPreference: 1.8     // Features VERY important
  },

  costEffects: {
    materials: +6,
    labour: +20,               // Tech talent war
    energy: +5,
    logistics: +8,
    outsourcing: +10           // Limited outsource tech capability
  },

  marketEffects: {
    taxRate: 0,
    interestRate: +1,
    exchangeRate: +3,
    tariffs: 0
  },

  techEffects: {
    rndCostChange: +25,        // R&D arms race
    tech1Attractiveness: 0.5,  // Old tech obsolete
    tech2Attractiveness: 0.8,
    tech3Attractiveness: 1.5,
    tech4Attractiveness: 2.0   // Bleeding edge tech premium
  },

  consumerPreferences: {
    qualityWeight: 1.9,        // Features matter MOST
    priceWeight: 0.5,          // Price doesn't matter
    brandLoyalty: 0.5          // Will switch for better tech
  }
}
```

**Business Implications**:
- Huge opportunity for Tech 3/4 players
- But R&D costs massive
- First-mover advantage critical
- Should you invest heavily in R&D now?

---

### Scenario 5: Trade War 🥊
```typescript
{
  id: 5,
  name: "Trade War",
  description: "Tariffs, protectionism, supply chain disruption",
  narrative: "Major economies impose steep tariffs on each other. Supply chains scramble to relocate. Imported materials become prohibitively expensive. Consumers face rising prices.",

  demandEffects: {
    overall: -8,
    priceElasticity: 1.3,
    qualityPreference: 1.0
  },

  costEffects: {
    materials: +22,            // Import materials hit by tariffs
    labour: +3,
    energy: +5,
    logistics: +30,            // Cross-border shipping nightmare
    outsourcing: +25           // Outsourcing penalized
  },

  marketEffects: {
    taxRate: 0,
    interestRate: +1,
    exchangeRate: +8,          // Domestic currency strong
    tariffs: +35               // HUGE tariff increases
  },

  techEffects: {
    rndCostChange: +5,
    tech1Attractiveness: 1.0,
    tech2Attractiveness: 1.0,
    tech3Attractiveness: 1.0,
    tech4Attractiveness: 1.0
  },

  consumerPreferences: {
    qualityWeight: 1.0,
    priceWeight: 1.3,
    brandLoyalty: 1.1          // Prefer domestic brands
  }
}
```

**Business Implications**:
- Logistics nightmare
- Should you relocate production to avoid tariffs?
- Local production vs imports tradeoff
- Transfer pricing strategy critical

---

### Scenario 6: Pandemic Recovery 🏥
```typescript
{
  id: 6,
  name: "Pandemic Recovery",
  description: "Pent-up demand released, but supply chains still broken",
  narrative: "Lockdowns end and consumers rush back to spend. However, factories struggle with absenteeism, ports are congested, and chip shortages persist.",

  demandEffects: {
    overall: +35,              // Massive pent-up demand
    priceElasticity: 0.8,
    qualityPreference: 1.2
  },

  costEffects: {
    materials: +18,            // Supply chain chaos
    labour: +12,               // Absenteeism, safety costs
    energy: +8,
    logistics: +40,            // Port congestion, container shortage
    outsourcing: +15           // Outsource partners unreliable
  },

  marketEffects: {
    taxRate: -5,               // Stimulus continues
    interestRate: -2,          // Still accommodative
    exchangeRate: -5,
    tariffs: 0
  },

  techEffects: {
    rndCostChange: +8,
    tech1Attractiveness: 0.9,
    tech2Attractiveness: 1.1,
    tech3Attractiveness: 1.2,
    tech4Attractiveness: 1.1
  },

  consumerPreferences: {
    qualityWeight: 1.3,
    priceWeight: 0.9,
    brandLoyalty: 0.8
  }
}
```

**Business Implications**:
- Demand is there, but can you deliver?
- Logistics bottleneck
- Should you overproduce and stockpile?
- Premium on reliable supply

---

### Scenario 7: Green Transition ♻️
```typescript
{
  id: 7,
  name: "Green Transition",
  description: "Carbon taxes, ESG regulations, sustainable production mandates",
  narrative: "Governments impose strict carbon taxes and ESG reporting. Consumers increasingly demand sustainable products. Supplier 3 (CSR-friendly) becomes critical.",

  demandEffects: {
    overall: +10,
    priceElasticity: 1.0,
    qualityPreference: 1.1
  },

  costEffects: {
    materials: +12,            // Sustainable materials cost more
    labour: +5,
    energy: +25,               // Carbon tax impact
    logistics: +15,            // Green logistics premium
    outsourcing: +8
  },

  marketEffects: {
    taxRate: +5,               // Carbon tax
    interestRate: 0,
    exchangeRate: 0,
    tariffs: +10               // Carbon border adjustments
  },

  techEffects: {
    rndCostChange: +15,        // Green tech R&D
    tech1Attractiveness: 0.7,  // Old tech stigmatized
    tech2Attractiveness: 0.9,
    tech3Attractiveness: 1.3,
    tech4Attractiveness: 1.5   // Green tech premium
  },

  consumerPreferences: {
    qualityWeight: 1.2,
    priceWeight: 1.1,
    brandLoyalty: 1.3,         // Loyal to sustainable brands
    csrBonus: 1.5              // NEW: Huge CSR bonus for Supplier 3
  }
}
```

**Business Implications**:
- CSR suddenly very valuable
- Supplier 3 choice becomes strategic
- Should you invest in green tech?
- ESG reporting burden

---

### Scenario 8: Commodity Shock ⛽
```typescript
{
  id: 8,
  name: "Commodity Price Shock",
  description: "Oil prices triple, materials scarce, energy crisis",
  narrative: "Geopolitical events cause oil prices to triple overnight. Material costs surge as energy-intensive production becomes prohibitively expensive.",

  demandEffects: {
    overall: -12,
    priceElasticity: 1.4,
    qualityPreference: 0.8
  },

  costEffects: {
    materials: +35,            // Material costs explode
    labour: +5,
    energy: +50,               // Energy CRISIS
    logistics: +45,            // Fuel-dependent
    outsourcing: +20
  },

  marketEffects: {
    taxRate: +2,
    interestRate: +3,
    exchangeRate: -12,
    tariffs: +5
  },

  techEffects: {
    rndCostChange: +8,
    tech1Attractiveness: 1.1,
    tech2Attractiveness: 1.0,
    tech3Attractiveness: 0.8,
    tech4Attractiveness: 0.7
  },

  consumerPreferences: {
    qualityWeight: 0.7,
    priceWeight: 1.5,
    brandLoyalty: 0.8
  }
}
```

---

### Scenario 9: Stable Growth 📈
```typescript
{
  id: 9,
  name: "Stable Sustainable Growth",
  description: "Goldilocks economy - moderate growth, low inflation",
  narrative: "The economy grows at a healthy 3.5% with inflation under control at 2.1%. Labor markets are balanced, and consumers feel confident but prudent.",

  demandEffects: {
    overall: +8,
    priceElasticity: 1.0,
    qualityPreference: 1.1
  },

  costEffects: {
    materials: +3,
    labour: +4,
    energy: +2,
    logistics: +3,
    outsourcing: +2
  },

  marketEffects: {
    taxRate: 0,
    interestRate: 0,
    exchangeRate: 0,
    tariffs: 0
  },

  techEffects: {
    rndCostChange: +5,
    tech1Attractiveness: 1.0,
    tech2Attractiveness: 1.1,
    tech3Attractiveness: 1.1,
    tech4Attractiveness: 1.0
  },

  consumerPreferences: {
    qualityWeight: 1.1,
    priceWeight: 1.0,
    brandLoyalty: 1.0
  }
}
```

**Business Implications**:
- "Normal" economic conditions
- Balanced strategy works
- Good time to invest for long term

---

### Scenario 10: Currency Crisis 💱
```typescript
{
  id: 10,
  name: "Currency Crisis",
  description: "Exchange rate volatility, capital flight, monetary instability",
  narrative: "The domestic currency crashes 30% against major currencies. Imports become prohibitively expensive, but exports surge. Companies with foreign debt face crisis.",

  demandEffects: {
    overall: -15,              // Domestic demand collapses
    priceElasticity: 1.6,
    qualityPreference: 0.7
  },

  costEffects: {
    materials: +40,            // Imported materials skyrocket
    labour: +10,               // Wages adjust
    energy: +30,               // Energy is imported
    logistics: +25,
    outsourcing: +35           // Outsourcing in foreign currency
  },

  marketEffects: {
    taxRate: +3,
    interestRate: +8,          // Emergency rate hike to defend currency
    exchangeRate: -30,         // HUGE depreciation
    tariffs: +15               // Emergency protection
  },

  techEffects: {
    rndCostChange: +30,        // R&D inputs often imported
    tech1Attractiveness: 1.2,
    tech2Attractiveness: 0.9,
    tech3Attractiveness: 0.6,
    tech4Attractiveness: 0.4
  },

  consumerPreferences: {
    qualityWeight: 0.6,
    priceWeight: 1.7,
    brandLoyalty: 0.7
  }
}
```

---

## Implementation in Google Sheets

### Scenarios Sheet Structure:
```
Column A: scenario_id (1-10)
Column B: name
Column C: description
Column D: narrative
Column E: demand_overall
Column F: demand_price_elasticity
Column G: demand_quality_preference
Column H: cost_materials
Column I: cost_labour
Column J: cost_energy
Column K: cost_logistics
Column L: cost_outsourcing
Column M: market_tax_rate
Column N: market_interest_rate
Column O: market_exchange_rate
Column P: market_tariffs
Column Q: tech_rnd_cost
Column R: tech1_attractiveness
Column S: tech2_attractiveness
Column T: tech3_attractiveness
Column U: tech4_attractiveness
Column V: consumer_quality_weight
Column W: consumer_price_weight
Column X: consumer_brand_loyalty
Column Y: consumer_csr_bonus
```

### Application Algorithm (Enhanced):
```typescript
function applyScenarioToMarket(
  previousParams: MarketParams,
  scenario: ImprovedScenario,
  market: 'us' | 'asia' | 'europe'
): MarketParams {

  // 1. Apply demand effects
  const newDemand = previousParams.demand × (1 + scenario.demandEffects.overall / 100)

  // 2. Apply differential cost effects
  const newMaterialCost = previousParams.materialCost × (1 + scenario.costEffects.materials / 100)
  const newLabourCost = previousParams.labourCost × (1 + scenario.costEffects.labour / 100)
  const newEnergyCost = previousParams.energyCost × (1 + scenario.costEffects.energy / 100)
  const newLogisticsCost = previousParams.logisticsCost × (1 + scenario.costEffects.logistics / 100)
  const newOutsourceCost = previousParams.outsourceCost × (1 + scenario.costEffects.outsourcing / 100)

  // 3. Apply market structure effects (absolute changes)
  const newTaxRate = previousParams.taxRate + (scenario.marketEffects.taxRate / 100)
  const newInterestRate = previousParams.interestRate + (scenario.marketEffects.interestRate / 100)
  const newExchangeRate = previousParams.exchangeRate × (1 + scenario.marketEffects.exchangeRate / 100)
  const newTariffs = previousParams.tariffs × (1 + scenario.marketEffects.tariffs / 100)

  // 4. Apply tech effects
  const newRndCost = previousParams.rndCost × (1 + scenario.techEffects.rndCostChange / 100)
  const newTech1Att = previousParams.tech1Att × scenario.techEffects.tech1Attractiveness
  const newTech2Att = previousParams.tech2Att × scenario.techEffects.tech2Attractiveness
  const newTech3Att = previousParams.tech3Att × scenario.techEffects.tech3Attractiveness
  const newTech4Att = previousParams.tech4Att × scenario.techEffects.tech4Attractiveness

  return {
    demand: newDemand,
    materialCost: newMaterialCost,
    labourCost: newLabourCost,
    energyCost: newEnergyCost,
    logisticsCost: newLogisticsCost,
    outsourceCost: newOutsourceCost,
    taxRate: newTaxRate,
    interestRate: newInterestRate,
    exchangeRate: newExchangeRate,
    tariffs: newTariffs,
    rndCost: newRndCost,
    tech1Att: newTech1Att,
    tech2Att: newTech2Att,
    tech3Att: newTech3Att,
    tech4Att: newTech4Att,
    // NEW: Consumer preferences affect market share calculation
    consumerPreferences: scenario.consumerPreferences
  }
}
```

---

## Educational Benefits

### 1. **Realistic Tradeoffs**:
- Boom: High demand BUT high costs → Margin vs volume
- Recession: Low demand BUT low costs → Survive vs grow
- Stagflation: Flat demand BUT soaring costs → Nightmare

### 2. **Strategic Thinking**:
- Tech Disruption: Should I invest heavily in R&D now?
- Trade War: Should I relocate production?
- Green Transition: Is CSR worth it?
- Pandemic Recovery: Can I deliver on demand?

### 3. **Real-World Complexity**:
- Not all costs move together
- Consumer preferences shift with economy
- Technology attractiveness varies by scenario
- Market structure affects profitability

### 4. **Decision Practice**:
- Students learn to READ scenarios carefully
- Adapt strategy to economic conditions
- Make difficult tradeoff decisions
- Learn consequences of miscalculation

---

## Migration Strategy

### Option A: Replace All 8 Scenarios
- Implement 10 new realistic scenarios
- Remove original uniform scenarios
- Update all documentation

### Option B: Hybrid Approach (Recommended)
- Keep original 8 for backward compatibility
- Add 10 new scenarios (IDs 9-18)
- Educators choose "Classic Mode" or "Advanced Mode"
- **Benefits**: Can compare old vs new system

### Option C: Gradual Introduction
- Start with 3 most different scenarios:
  - Scenario 11: Stagflation (mixed nightmare)
  - Scenario 12: Tech Disruption (innovation boom)
  - Scenario 13: Trade War (logistics nightmare)
- Test with students
- Expand if positive feedback

---

## Summary

### What Changes:
❌ **Old**: All 29 parameters change by same %
✅ **New**: Parameters change differently based on economic reality

### What Stays Same:
✅ Random scenario selection per market per round
✅ Compounding effects over rounds
✅ Simple % change application
✅ Round_Assumptions storage structure

### Result:
🎯 **More realistic simulation**
🎯 **Better teaches business strategy**
🎯 **More engaging for students**
🎯 **Same implementation complexity**

The improved scenario system makes Bonopoly even more powerful as a teaching tool! 🚀
