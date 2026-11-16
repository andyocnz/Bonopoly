# AIgology Strategy Lab - Student Guide

## The Game

You are the CEO of a company that manufactures and sells products in a global market. The industry depends on what your lecturer sets up (electronics, energy, etc.). You compete against other students' companies over **20 rounds** — think of each round as one business quarter.

At the end of 20 rounds, whoever has the **highest share price** wins.

Share price goes up when your company is **profitable**, **growing**, and **well-managed**. It goes down when you're losing money, losing customers, or drowning in debt.

---

## Your Business

Before you write any code, you need to understand how your company makes money.

### How you make money

```
Revenue       =  Units Sold  x  Price Per Unit
- COGS        =  Units Sold  x  Cost Per Unit     (materials, labor, shipping)
= Gross Profit
- Expenses    =  R&D + Marketing + Admin + Depreciation + Interest
= Net Profit
```

Your share price is driven by **net profit**, revenue growth, and market share gains. Lose money consistently and your share price crashes.

### What things cost

Your products have a **manufacturing cost** that depends on where you build them:

| Cost Component | US Factory | Asia Factory |
|---------------|-----------|-------------|
| Materials | ~$22/unit | ~$18/unit |
| Labor | ~$14/unit | ~$7/unit |
| **Base cost** | **~$36/unit** | **~$25/unit** |
| + Supplier markup (5-15%) | ~$38/unit | ~$26/unit |

Asia is cheaper to manufacture in, but if you sell those units in the US or Europe, you pay **shipping costs** ($7-10/unit cross-region).

If your factories can't keep up with demand, you can outsource production at a **30% premium** on top of base cost.

### What you can charge

Baseline selling prices by region:

| Region | Baseline Price | Your Cost (local factory) | Gross Margin |
|--------|---------------|--------------------------|-------------|
| **US** | ~$125 | ~$38 | ~70% |
| **Asia** | ~$115 | ~$26 | ~77% |
| **Europe** | ~$130 | ~$38 + $7 shipping | ~66% |

These margins look healthy, but remember: you still pay for R&D staff, marketing, admin (3% of revenue), factory depreciation, interest on debt, and 25% tax. **Net margins are much thinner.**

### The 3 regions

| Region | Share of Global Demand | Price Sensitivity | What this means |
|--------|----------------------|-------------------|-----------------|
| **US** | 22% | Low | Customers pay more for quality. Premium pricing works here. |
| **Asia** | 60% | High | Customers are price-sensitive. Small price cuts = big volume gains. |
| **Europe** | 18% | Medium | Balanced market. |

Asia is **60% of total demand**. If you ignore Asia pricing, you're ignoring most of the market.

### Key investments

| Investment | Cost | What it does |
|-----------|------|-------------|
| **New US factory** | ~$30M | +325,000 units/quarter production capacity |
| **New Asia factory** | ~$18M | +325,000 units/quarter production capacity |
| **R&D spending** | Ongoing | Unlocks product features over time. More features = higher quality = customers pay more. |

### The fundamental tradeoffs

- **Low prices** = sell more units, but thinner profit margins
- **High prices** = fatter margins, but fewer customers (especially in Asia)
- **R&D investment** = costs money now, but unlocks features that justify premium pricing later
- **Factory investment** = $18-30M upfront, but more capacity means more potential revenue
- **Aggressive early** = grab market share but burn cash. Risky if competitors match your prices.
- **Conservative early** = save cash but risk falling behind on capacity and R&D

---

## How the Code Works

Instead of clicking buttons every round, **you write code that makes your decisions automatically**. Your code is a single JavaScript function that the simulation calls once per round.

```
Every round:
  1. The simulation gives your function the current state of the game
     (your financials, your market share, what competitors are charging, etc.)

  2. Your function analyzes the situation and returns decisions
     (adjust prices? increase production? build a factory? invest in R&D?)

  3. The simulation executes everyone's decisions simultaneously,
     calculates who sells how much, and updates profits and share prices

  4. Next round begins
```

Think of it as writing an **autopilot for your business**. You define the strategy, the simulation runs it.

---

## Your First Strategy

Let's start with a business decision and turn it into code.

### Step 1: Know your costs

| | US | Asia |
|---|---|---|
| Manufacturing cost | ~$38/unit | ~$26/unit |

### Step 2: Decide your target margin

You want a **60% gross margin** in the US. That means:

```
Target price  =  Cost / (1 - margin)
              =  $38 / (1 - 0.60)
              =  $38 / 0.40
              =  $95
```

For Asia (cheaper to produce, price-sensitive market), you want a **55% margin**:

```
Target price  =  $26 / (1 - 0.55)  =  $58
```

### Step 3: Convert to code

The simulation uses a baseline price (~$125 US, ~$115 Asia, ~$130 Europe). Your `priceMultiplier` adjusts that baseline. To get your target price:

```
priceMultiplier  =  target price / baseline price
US:    $95 / $125  =  0.76
Asia:  $58 / $115  =  0.50
```

Create a file called `my_strategy.js`:

```js
// name: Margin Target Strategy
// author: Your Name

function execute(context) {
  // Target: 60% margin in US ($95), 55% in Asia ($58), 60% in Europe ($95)
  return {
    priceMultiplier: { us: 0.76, asia: 0.50, europe: 0.73 }
  }
}
```

That's a complete, working strategy. You started from costs and margins — the multiplier is just the final translation step.

Of course, this is a very aggressive pricing strategy. You could target higher margins (70-75%) and set prices closer to the baseline. The right margin depends on your competitive strategy — are you competing on price or on quality?

**Submit this `.js` file to your lecturer.** They'll upload everyone's strategies and run the tournament.

---

## What Your Decisions Mean (In Business Terms)

Your function returns an object that adjusts the default business decisions. Every field is optional — omit anything you don't want to control.

### Pricing: `priceMultiplier`

This is your most important lever. Start from your costs and target margin, then calculate the multiplier.

**How to calculate:** `target price = cost / (1 - target margin)`, then `multiplier = target price / baseline price`

Reference table for US (cost ~$38, baseline ~$125):

| Target Margin | Target Price | Multiplier | Business Meaning |
|--------------|-------------|-----------|-----------------|
| 50% | $76 | `0.61` | Aggressive pricing. High volume play, very thin after operating costs. |
| 60% | $95 | `0.76` | Competitive pricing. Solid margins, attracts price-conscious buyers. |
| 65% | $109 | `0.87` | Moderate discount. Slightly below market to gain share. |
| 70% | $127 | `1.00` | Market rate. Default pricing — this is where most competitors start. |
| 75% | $152 | `1.22` | Premium pricing. Needs strong R&D and product quality to justify. |
| 80% | $190 | `1.52` | Luxury pricing. Only works if your product is clearly the best. |

Remember: gross margin is not net profit. You still pay R&D, marketing, admin, depreciation, interest, and tax. A 60% gross margin might be only 5-10% net profit.

```js
return {
  priceMultiplier: {
    us: 0.87,      // Target ~65% margin in US (less price-sensitive)
    asia: 0.65,    // Target ~60% margin in Asia (price-sensitive, 60% of demand)
    europe: 0.90   // Target ~66% margin in Europe
  }
}
```

Range: **0.5 to 2.0**. Values outside this are clamped automatically.

### Production volume: `productionMultiplier`

How many units to manufacture relative to default.

- Produce too little → you miss sales, competitors take your customers
- Produce too much → unsold inventory piles up, costing you storage fees

```js
return { productionMultiplier: 1.1 }  // Make 10% more than default
// Or per-region:
return { productionMultiplier: { us: 1.2, asia: 0.9 } }
```

Range: **0.1 to 3.0**.

### R&D investment: `rdInvestmentMultiplier`

Scale your research spending. R&D is cumulative — the more you invest over time, the more features you unlock. Features improve product quality, which means customers are willing to pay higher prices.

- `0.5` = cut R&D budget in half (save cash, but your product falls behind competitors)
- `1.5` = spend 50% more on R&D (expensive now, but pays off later as premium pricing)
- `2.0` = double R&D budget (aggressive innovation bet)

```js
return { rdInvestmentMultiplier: 1.5 }
```

Range: **0.0 to 5.0**.

### Factory investment: `forceInvestment`

Build new factories. Each factory adds 325,000 units of production capacity per quarter.

- US factory: ~$30M
- Asia factory: ~$18M

Be careful — this is a massive cash outflow. A $30M factory when you only have $15M cash means taking on debt.

```js
return { forceInvestment: { us: 1, asia: 0 } }  // Build 1 US factory this round
```

Range: **0 to 3** per region per round.

Or block all factory construction to save cash:

```js
return { blockInvestment: true }
```

### Regional focus: `regionalFocus`

Concentrate your marketing and production on one region.

```js
return { regionalFocus: 'asia' }  // Focus on Asia (60% of global demand)
```

Options: `'us'`, `'asia'`, or `'europe'`.

### Behavior flags

```js
return { cooperativeMode: true }   // Signal cooperative: maintain higher prices
return { aggressiveMode: true }    // Signal aggressive: undercut competitors
```

### Returning empty

Returning `{}` is valid. It means "use the default AI decisions for everything."

```js
function execute(context) {
  return {}
}
```

---

## What Information You Get Each Round

Your function receives a `context` object with your business intelligence. Here's what's inside:

### Game progress

```js
context.round        // Current quarter (1, 2, 3, ... up to 20)
context.totalRounds  // Total quarters in the game (usually 20)
```

### Your company's financials

```js
context.myTeam.cash          // Cash on hand (e.g. $15,000,000)
context.myTeam.debt          // Outstanding debt (e.g. $20,000,000)
context.myTeam.sharePrice    // Your stock price — THIS IS HOW YOU WIN
context.myTeam.marketCap     // Market capitalization
```

### Your sales performance

```js
// Market share — what fraction of each region's customers buy from you (0 to 1)
context.myTeam.marketShare.us      // e.g. 0.28 = 28% of US market
context.myTeam.marketShare.asia    // e.g. 0.22 = 22% of Asia market
context.myTeam.marketShare.europe  // e.g. 0.25 = 25% of Europe market

// Units sold this round
context.myTeam.sales.us
context.myTeam.sales.asia
context.myTeam.sales.europe

// Your current selling prices
context.myTeam.prices.us       // e.g. $125
context.myTeam.prices.asia     // e.g. $115
context.myTeam.prices.europe   // e.g. $130
```

### Your operations

```js
// Factories (each = 325,000 units capacity)
context.myTeam.factories.us    // e.g. 1
context.myTeam.factories.asia  // e.g. 0

// Units produced this round
context.myTeam.production.us
context.myTeam.production.asia

// Unsold inventory sitting in warehouse (costs money to hold)
context.myTeam.inventory.us
context.myTeam.inventory.asia

// Last round's prices (undefined in round 1)
context.myTeam.previousPrices.us
context.myTeam.previousPrices.asia
context.myTeam.previousPrices.europe
```

### Competitor intelligence

You can see your competitors' public data (same fields as your own team):

```js
context.competitors              // Array of all competitor teams
context.competitors.length       // How many competitors (e.g. 3)

context.competitors[0].sharePrice       // Their stock price
context.competitors[0].prices.asia      // What they charge in Asia
context.competitors[0].marketShare.us   // Their US market share
context.competitors[0].cash             // Their cash position
context.competitors[0].factories.us     // Their factory count
```

You **cannot** see competitors' costs, profit margins, or internal strategy — just their prices, market share, and financials. You have to infer what they're doing.

### Market overview

```js
context.marketData.avgPrice.us       // Average selling price in US across all teams
context.marketData.avgPrice.asia     // Average selling price in Asia
context.marketData.avgPrice.europe   // Average selling price in Europe
context.marketData.avgMarketShare    // Fair share = 1 / number of teams
context.marketData.totalDemand.us    // Total customer demand in US (units)
context.marketData.totalDemand.asia  // Total customer demand in Asia
context.marketData.totalDemand.europe // Total customer demand in Europe
context.marketData.priceRange.min    // Cheapest price in the market
context.marketData.priceRange.max    // Most expensive price in the market
```

### History (last 5 rounds)

```js
context.history.length                          // Number of past rounds available
context.history[0].round                        // Which round
context.history[0].myResults.sharePrice         // Your share price that round
context.history[0].myResults.cash               // Your cash that round
context.history[0].myResults.marketShare        // Your market share that round
context.history[0].marketSnapshot.avgPrice.us   // Market average price that round
```

### Persistent memory between rounds

An object that **survives across rounds**. Use it to track trends, count events, or store any data you want:

```js
// Store something:
context.strategyState.lastSharePrice = context.myTeam.sharePrice
context.strategyState.roundsWithoutFactory = 0

// Read it next round:
var prev = context.strategyState.lastSharePrice
```

---

## Example Strategies

### Example 1: "The Discounter" (Beginner)

**Business logic:** Undercut the market to gain volume. Accept thinner margins for more customers.

With a 0.92 multiplier in the US: price drops from ~$125 to ~$115. Cost is ~$38. Gross margin is still 67% — healthy enough, and you'll outsell higher-priced competitors.

```js
// name: The Discounter
// author: Student A

function execute(context) {
  return {
    priceMultiplier: { us: 0.92, asia: 0.90, europe: 0.93 }
  }
}
```

**Risk:** If everyone undercuts, prices spiral down and nobody makes money (race to the bottom).

---

### Example 2: "Early Investor" (Intermediate)

**Business logic:** Invest heavily in the first 40% of the game — build factories, fund R&D, accept lower prices to grab market share. In the second half, your superior capacity and product features let you charge premium prices with high volume.

Early phase: factory costs ~$30M, R&D burn is high. But by round 8+, you have more capacity and better products than competitors who played it safe.

```js
// name: Early Investor
// author: Student B

function execute(context) {
  var progress = context.round / context.totalRounds

  if (progress < 0.4) {
    // Phase 1: invest and grab share. Price below cost? No — $125 x 0.88 = $110,
    // cost is ~$38, so gross margin is still 65%. We're fine.
    return {
      priceMultiplier: { us: 0.88, asia: 0.85, europe: 0.90 },
      forceInvestment: { us: 1, asia: 0 },
      rdInvestmentMultiplier: 1.8
    }
  }

  // Phase 2: harvest. Better products + more capacity = premium pricing.
  return {
    priceMultiplier: { us: 1.08, asia: 1.05, europe: 1.10 },
    productionMultiplier: 1.1
  }
}
```

**Risk:** If you burn through cash before phase 2 kicks in, you go bankrupt. Watch that cash balance.

---

### Example 3: "The Reactor" (Intermediate)

**Business logic:** Monitor your market share vs. the average. If you're losing customers, cut prices to compete. If you're winning, raise prices to maximize profit per unit.

```js
// name: The Reactor
// author: Student C

function execute(context) {
  var myShare = context.myTeam.marketShare
  var fairShare = context.marketData.avgMarketShare

  // Am I above or below average market share?
  var myAvgShare = (myShare.us + myShare.asia + myShare.europe) / 3

  if (myAvgShare < fairShare) {
    // Losing customers — cut prices to win them back
    return {
      priceMultiplier: { us: 0.90, asia: 0.88, europe: 0.92 },
      productionMultiplier: 1.15,
      aggressiveMode: true
    }
  }

  // Winning — charge more, invest the profits into R&D
  return {
    priceMultiplier: { us: 1.08, asia: 1.05, europe: 1.10 },
    rdInvestmentMultiplier: 1.3,
    cooperativeMode: true
  }
}
```

**Risk:** Purely reactive. By the time you notice you're losing, the damage may already be done.

---

### Example 4: "Cash-Conscious" (Advanced)

**Business logic:** Always check your financial health before making aggressive moves. If cash is low, go defensive (raise prices, cut spending). If cash is strong, invest.

This is how real CFOs think — you can't grow if you're about to run out of money.

```js
// name: Cash-Conscious
// author: Student D

function execute(context) {
  var team = context.myTeam
  var state = context.strategyState

  // Track profit trend
  if (context.round === 1) {
    state.lastCash = team.cash
    return { priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 } }
  }

  var cashFlow = team.cash - state.lastCash  // Did we make or lose money?
  state.lastCash = team.cash

  // DANGER: cash below $10M — survival mode
  if (team.cash < 10000000) {
    return {
      priceMultiplier: { us: 1.15, asia: 1.10, europe: 1.20 },
      productionMultiplier: 0.7,
      blockInvestment: true,
      rdInvestmentMultiplier: 0.5
    }
  }

  // HEALTHY: cash above $40M and positive cash flow — invest
  if (team.cash > 40000000 && cashFlow > 0) {
    return {
      priceMultiplier: { us: 0.95, asia: 0.93, europe: 0.97 },
      forceInvestment: context.round <= 8 ? { us: 1, asia: 0 } : undefined,
      rdInvestmentMultiplier: 1.5
    }
  }

  // NORMAL: moderate approach
  return {
    priceMultiplier: { us: 1.0, asia: 0.97, europe: 1.02 },
    rdInvestmentMultiplier: 1.1
  }
}
```

**Risk:** Too conservative. While you're preserving cash, aggressive competitors may grab market share that's hard to win back.

---

### Example 5: "The Strategist" (Expert)

**Business logic:** Combines multiple business signals — regional strength analysis, competitor monitoring, investment timing, and R&D phasing. Plays different strategies in different regions.

```js
// name: The Strategist
// author: Student E

function execute(context) {
  var team = context.myTeam
  var market = context.marketData
  var round = context.round

  // SURVIVAL: cash below $10M = emergency mode
  if (team.cash < 10000000) {
    return {
      priceMultiplier: { us: 1.15, asia: 1.10, europe: 1.20 },
      productionMultiplier: 0.7,
      blockInvestment: true,
      rdInvestmentMultiplier: 0.5
    }
  }

  // REGIONAL ANALYSIS: find where we have the strongest market position
  var shares = team.marketShare
  var bestRegion = 'us'
  if (shares.asia > shares.us && shares.asia > shares.europe) bestRegion = 'asia'
  if (shares.europe > shares.us && shares.europe > shares.asia) bestRegion = 'europe'

  // Defend our strongest region with competitive pricing, charge premium elsewhere
  var prices = { us: 1.05, asia: 1.03, europe: 1.07 }
  prices[bestRegion] = 0.93  // Discount where we're strong to protect share

  // INVESTMENT: build factories early when we can afford it
  var investment = undefined
  if (round <= 5 && team.cash > 40000000) {
    investment = { us: 1, asia: 0 }
  }

  // R&D: heavy in first half (building product quality), taper in second half
  var rdMultiplier = round <= 10 ? 1.5 : 1.0

  // COMPETITOR SCAN: if someone is far ahead, go more aggressive
  var leader = context.competitors[0]
  for (var i = 1; i < context.competitors.length; i++) {
    if (context.competitors[i].sharePrice > leader.sharePrice) {
      leader = context.competitors[i]
    }
  }
  if (leader.sharePrice > team.sharePrice * 1.5) {
    // Leader is 50%+ ahead — undercut aggressively in Asia (biggest market)
    prices = { us: 0.93, asia: 0.85, europe: 0.95 }
  }

  return {
    priceMultiplier: prices,
    rdInvestmentMultiplier: rdMultiplier,
    forceInvestment: investment,
    regionalFocus: bestRegion,
    productionMultiplier: 1.05
  }
}
```

---

## Rules

1. Your file must contain **`function execute(context)`** — this is the only requirement
2. Return an object with your decisions. All fields are optional
3. Values are clamped to safe ranges automatically (you can't break the game)
4. If your function crashes, default decisions are used — the game continues without you for that round
5. Use **`var`** instead of `let`/`const` for compatibility
6. No external access — no `fetch`, `import`, `require`, `document`, `window`, `setTimeout`
7. Your function runs once per round. No async, no promises, no callbacks

---

## Tips for Winning

- **Understand the economics first.** Your cost is ~$25-38/unit. Your price is ~$115-130. Know your margins before you start adjusting them.
- **Asia is 60% of demand.** A 5% price cut in Asia moves more units than a 10% cut in Europe.
- **Watch your cash.** Factories cost $18-30M. R&D is ongoing. Running out of cash means taking debt, which means interest, which eats your profits.
- **R&D compounds.** Companies that invest early in R&D unlock better features, which justifies higher prices later. Late R&D investment rarely catches up.
- **There is no single best strategy.** A strategy that beats Opponent A might lose to Opponent B. The best strategies read the market and adapt.
- **Extreme values rarely win.** A `priceMultiplier` of `0.5` means selling at ~$60 — still above cost, but your operating expenses will eat all the margin. A multiplier of `2.0` means ~$250 — nobody will buy from you.
- **Change one thing at a time.** If you adjust prices AND production AND R&D, you won't know which change helped.
- **Track your cash flow.** If `context.myTeam.cash` is dropping every round, something is wrong — you're spending more than you're earning.

---

## File Template

Copy this, rename it, and start editing:

```js
// name: YOUR STRATEGY NAME
// author: YOUR NAME

function execute(context) {
  // Your company's data:
  //   context.myTeam.cash         - cash on hand
  //   context.myTeam.sharePrice   - your stock price (how you win)
  //   context.myTeam.prices       - your current prices { us, asia, europe }
  //   context.myTeam.marketShare  - your market share { us, asia, europe }
  //   context.myTeam.sales        - units sold { us, asia, europe }
  //   context.myTeam.factories    - factory count { us, asia }
  //   context.myTeam.debt         - outstanding debt
  //
  // Market data:
  //   context.marketData.avgPrice     - average prices { us, asia, europe }
  //   context.marketData.totalDemand  - customer demand { us, asia, europe }
  //   context.marketData.priceRange   - { min, max } prices in market
  //
  // Competitors:
  //   context.competitors[0].sharePrice, .prices, .marketShare, .cash, etc.
  //
  // Game state:
  //   context.round / context.totalRounds
  //   context.strategyState - your persistent memory between rounds

  return {
    priceMultiplier: { us: 1.0, asia: 1.0, europe: 1.0 }
  }
}
```
