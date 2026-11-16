# Strategy Lab: Academic Whitepaper
## Game Theory Simulation Laboratory for Business Education

**Version:** 1.0
**Last Updated:** January 2026
**Target Audience:** Educators, Academic Reviewers, Curriculum Designers

---

## Executive Summary

The **Strategy Lab** is an integrated simulation environment designed to support the teaching of oligopoly competition, game theory, and strategic decision-making through controlled experiments with statistical analysis. Building on traditional game simulations, Strategy Lab aims to facilitate **hypothesis-driven research** through batch experimentation, statistical validation (t-tests, effect sizes, confidence intervals), and calculation auditing.

**Core Value Proposition:** Seeks to help transform abstract game theory concepts into empirically testable hypotheses that students can explore through Monte Carlo simulations with statistical analysis.

---

## 1. Pedagogical Framework

### 1.1 Learning Objectives

Students who complete Strategy Lab modules are expected to develop the ability to:

1. **Apply Game Theory Concepts**
   - Recognize Nash equilibria in oligopolistic markets
   - Understand the Prisoner's Dilemma in pricing competition
   - Evaluate mixed vs. pure strategy outcomes
   - Analyze repeated game dynamics and retaliation strategies

2. **Conduct Empirical Analysis**
   - Formulate testable hypotheses about strategic behavior
   - Design controlled experiments with proper sample sizes
   - Interpret t-statistics, p-values, and effect sizes (Cohen's d)
   - Distinguish statistical significance from practical significance

3. **Understand Business Strategy**
   - Evaluate trade-offs between short-term profit and long-term value
   - Assess first-mover advantages in R&D and capacity investment
   - Analyze the impact of cooperative vs. predatory pricing
   - Model ESG (Environmental/Social/Governance) investment decisions

### 1.2 Bloom's Taxonomy Alignment

| Level | Strategy Lab Activity |
|-------|----------------------|
| **Remember** | Identify strategy types (Tit-for-Tat, Grim Trigger, etc.) |
| **Understand** | Explain why cooperative strategies outperform predatory pricing |
| **Apply** | Configure experiments to test specific hypotheses |
| **Analyze** | Interpret distribution charts, box plots, and statistical tests |
| **Evaluate** | Assess whether findings support or reject hypotheses |
| **Create** | Design custom experiments and tournament matchups |

---

## 2. Simulation Architecture

### 2.1 Core Components

**Three Operating Modes:**

1. **Visualizer Mode**
   - Single simulation run with round-by-round visualization
   - Real-time charts tracking share price, market share, profit, production
   - Calculation audit trail showing P&L, market share, and share price formulas
   - **Use Case:** Demonstrate strategy behavior, debug unexpected outcomes

2. **Research Lab Mode**
   - Batch experimentation (10-500 games per experiment)
   - Pre-configured research questions based on classic game theory problems
   - Statistical analysis: t-tests, confidence intervals, effect sizes
   - Distribution visualization: histograms and box plots
   - **Use Case:** Validate hypotheses with statistical rigor for academic assignments

3. **Tournament Mode**
   - Round-robin competition between multiple strategies
   - Head-to-head performance matrix with win rates
   - Strategy performance heatmap
   - **Use Case:** Compare strategy effectiveness across diverse matchups

### 2.2 Strategy Archetypes (12 Total)

| Strategy ID | Name | Game Theory Concept |
|-------------|------|---------------------|
| `tit-for-tat` | Tit-for-Tat | Reciprocity, conditional cooperation |
| `predatory-pricing` | Predatory Pricing | Price warfare, market share capture |
| `premium` | Premium Strategy | Quality differentiation, high-margin positioning |
| `capacity-leader` | Capacity Leader | First-mover advantage through capacity investment |
| `regional-asia` | Regional Specialist (Asia) | Geographic focus, market specialization |
| `innovator` | Innovator | R&D investment, technology leadership |
| `adaptive` | Adaptive Strategy | Market sensing, dynamic response |
| `mean-reversion` | Mean Reversion | Price normalization, contrarian positioning |
| `momentum` | Momentum | Trend following, reinforcement |
| `mixed` | Mixed Strategy | Randomized decisions, unpredictability |
| `grim-trigger` | Grim Trigger | Permanent retaliation, credible threats |
| `win-stay-lose-shift` | Win-Stay-Lose-Shift | Reinforcement learning, hill climbing |

Each strategy implements decision rules for:
- **Pricing:** Market positioning relative to competitors
- **Production:** Capacity utilization and inventory management
- **R&D Investment:** Technology advancement and feature unlocking
- **Marketing:** Regional advertising spend allocation
- **Capital Investment:** Factory expansion decisions

### 2.3 Market Simulation Engine

**Economic Model:**
- **Demand Function:** Price-elastic demand with regional differentiation (US, Asia, Europe)
- **Cost Structure:** Variable costs (materials, labor, logistics) + Fixed costs (R&D, marketing, admin, HR) + Capital costs (depreciation, interest)
- **Profitability:** Full P&L calculation from Revenue → COGS → Gross Profit → EBITDA → EBIT → Profit Before Tax → Net Profit
- **Valuation:** Share price driven by ROE, profit margin, market share, and growth rate

**Scenario Modifiers:**
- Demand shocks (Asia Boom, European Recession, etc.)
- Cost inflation/deflation
- Interest rate changes
- Price elasticity shifts
- CSR importance fluctuations

**Physics Constraints:**
- Inventory continuity (Beginning Inventory + Production - Sales = Ending Inventory)
- Capacity limits (Production ≤ Factory Capacity × 1.1 with outsourcing)
- Financial integrity (No negative share prices, bankruptcy detection)

---

## 3. Statistical Rigor

### 3.1 Hypothesis Testing Framework

All Research Lab experiments follow this structure:

1. **Hypothesis Statement**
   - Null Hypothesis (H0): No difference between strategy groups
   - Alternative Hypothesis (H1): Cooperative strategies outperform predatory strategies

2. **Experimental Design**
   - Control variables: Same market conditions, scenario sequence, game rules
   - Treatment variables: Strategy assignments
   - Sample size: User-configurable (10-500 games)

3. **Statistical Tests**
   - **Two-Sample Welch's t-test:** Compares means of two groups (does not assume equal variances)
   - **Significance Level (α):** 0.05 (5% Type I error rate)
   - **Effect Size (Cohen's d):** Measures practical significance
     - d > 0.8: Large effect
     - 0.5 < d ≤ 0.8: Medium effect
     - 0.2 < d ≤ 0.5: Small effect
   - **Confidence Intervals:** 95% CI for mean difference
   - **Note:** Bonferroni correction function is available for multiple comparison scenarios (not currently applied in default experiments)

4. **Distribution Analysis**
   - **Histograms:** Show frequency distribution of outcomes
   - **Box Plots:** Display median, quartiles, IQR, and outliers
   - **Statistical Summaries:** Mean, median, min, max, Q1, Q3, outliers

### 3.2 Sample Experiment: "Do Price Wars Reduce Industry Profit?"

**Setup:**
- **Teams:** 3 Predatory Pricing + 1 Tit-for-Tat (cooperative)
- **Rounds:** 12
- **Sample Size:** 100 games
- **Hypothesis:** Cooperative strategies yield higher share price than predatory strategies

**Typical Results** *(illustrative - actual results vary based on scenario sequence and market conditions):*
- **Cooperative Mean Share Price:** ~$120 ± 15
- **Predatory Mean Share Price:** ~$100 ± 20
- **t-statistic:** ~4.5
- **p-value:** < 0.001 (highly significant)
- **Cohen's d:** ~0.9 (large effect)
- **Interpretation:** When observed, cooperative strategy tends to outperform predatory pricing, which may illustrate the Prisoner's Dilemma in oligopoly markets

**Pedagogical Insight:** Students may observe that while predatory pricing aims to capture market share through price cuts, it can trigger retaliatory price wars that erode industry profitability for all players. The Tit-for-Tat strategy, by cooperating initially and retaliating only when betrayed, tends to maintain higher prices and profits.

---

## 4. Calculation Audit Trail

To support pedagogical accuracy and facilitate debugging, the **Calculation Audit Panel** provides step-by-step verification of simulation calculations:

### 4.1 Audited Calculations

**1. Market Share Calculation**
```
Formula: Market Share = Team Units Sold / Total Market Demand

Inputs:
- Team Units Sold: 250,000
- Total Market Demand: 1,000,000

Steps:
1. Team Units Sold: 250,000
2. Total Market Demand: 1,000,000
3. Market Share: 0.25 (25%)

✓ Calculated: 25.0%
✓ Actual: 25.0%
✓ Match: Yes
```

**2. Profit Calculation**
```
Formula: Profit = Revenue - COGS - Operating - Depreciation - Interest - Tax

Inputs:
- Revenue: $64,919,496
- COGS: $31,757,306

Steps:
1. Revenue: $64,919,496
2. - Cost of Goods Sold: -$31,757,306
3. = Gross Profit: $33,162,190
4. - Operating Expenses (R&D, Marketing, Admin, HR): -$8,500,000
5. = EBITDA: $24,662,190
6. - Depreciation: -$1,500,000
7. = EBIT: $23,162,190
8. - Interest Expense: -$1,000,000
9. = Profit Before Tax: $22,162,190
10. - Tax: -$8,864,876
11. = Net Profit: $13,297,314

✓ Calculated: $13,297,314
✓ Actual: $13,297,314
✓ Match: Yes (within $1,000 tolerance)
```

**3. Share Price Calculation**
```
Formula (simplified): Share Price = EPS × P/E Ratio × Growth Premium × Quality Multiplier
(with smoothing, floor protection, and debt penalty - see Appendix B for full formula)

Example Calculation:
- EPS (Earnings Per Share): $8.50
- Base P/E Ratio: 15.0
- Growth Premium: 1.12 (based on capacity growth, market share gain, brand, cash)
- Quality Multiplier: 1.08 (based on profit margin and ROE)
- Adjusted P/E: 15.0 × 1.12 × 1.08 = 18.14
- Base Share Price: $8.50 × 18.14 = $154.19
- Previous Share Price: $150.00
- Smoothed Price: ($150 × 0.45) + ($154.19 × 0.55) = $152.30
- Debt Penalty: 0.05 (5% debt-to-asset ratio penalty)
- Final Share Price: $152.30 × (1 - 0.05) = $144.69

✓ Calculated: $144.69
✓ Actual: $144.69
✓ Match: Yes
```

### 4.2 Physics Verification

**Inventory Continuity Check:**
```
Beginning Inventory: 50,000
+ Production: 250,000
- Sales: 240,000
= Expected Ending Inventory: 60,000
✓ Actual Ending Inventory: 60,000
✓ Passed
```

**Capacity Constraint Check:**
```
Factories: 2 (US) + 1 (Asia) = 3 total
Capacity per Plant: 325,000
Total Capacity: 975,000
Production: 250,000
✓ Production ≤ Capacity (with 10% outsourcing buffer)
✓ Passed
```

**Financial Integrity Check:**
```
✓ Share Price ≥ $0
✓ No division by zero
✓ All values within valid ranges
✓ Passed
```

### 4.3 Scenario Modifier Verification

The audit panel shows which scenario was applied and confirms all modifiers were correctly applied:

```
Scenario: Asia Boom (ID: 1)

Modifiers Applied:
- Demand Multiplier: US +0%, Asia +50%, Europe +0%
- Price Elasticity: 1.0x (no change)
- CSR Importance: 1.0x (no change)
- Marketing Effect: 1.0x (no change)
- Cost Inflation: 1.0x (no change)
- Investment Cost: 1.0x (no change)
- Interest Rate Spread: +0%

✓ Scenario Applied Correctly
```

---

## 5. Pre-Configured Research Questions

### 5.1 Price War Experiment
**Research Question:** Do price wars reduce industry profit?

**Hypothesis:** Cooperative strategies yield higher share price than predatory strategies in oligopoly markets.

**Setup:**
- 3 Predatory Pricing teams + 1 Tit-for-Tat team
- 12 rounds, random scenarios
- High elasticity (1.5x) to amplify price war effects

**Expected Learning:**
- Students may observe the **Prisoner's Dilemma** in action
- Predatory pricing can trigger a race to the bottom
- Industry profitability may erode for all players
- Cooperative strategy (Tit-for-Tat) tends to maintain pricing discipline

**Game Theory Concepts:** Prisoner's Dilemma, Nash Equilibrium, Dominant Strategy Paradox

---

### 5.2 Innovator Advantage Experiment
**Research Question:** Does first-mover R&D investment pay off?

**Hypothesis:** Premium (innovation-focused) strategies outperform Tit-for-Tat (followers) in long-term value creation.

**Setup:**
- 1 Premium (Innovator) team + 3 Tit-for-Tat (Followers) teams
- 20 rounds, Asia Boom scenario (favors innovation)
- Higher starting cash ($80M) to enable R&D investment

**Expected Learning:**
- First-mover advantage in product differentiation
- R&D creates sustainable competitive advantage
- Premium pricing power from superior features
- Long-term TSR (Total Shareholder Return) outperformance

**Game Theory Concepts:** First-Mover Advantage, Sunk Costs, Entry Barriers, Credible Commitments

---

### 5.3 ESG Long-Term Value
**Research Question:** Is ESG (Environmental/Social/Governance) investment profitable in the long run?

**Hypothesis:** High CSR strategies outperform cost leadership in simulations > 20 rounds.

**Setup:**
- 2 Premium (ESG-focused) teams + 2 Capacity Leader (cost-focused) teams
- 25 rounds, random scenarios
- Higher demand (1.2x) to reward differentiation

**Expected Learning:**
- CSR investment builds brand reputation and customer loyalty
- Short-term cost disadvantage vs. long-term value creation
- Sustainable practices can drive profitability
- Market rewards differentiation over pure cost competition

**Game Theory Concepts:** Repeated Games, Reputation Effects, Long-Term vs. Short-Term Optimization

---

### 5.4 Nash Equilibrium Convergence
**Research Question:** Do rational agents converge to Nash Equilibrium?

**Hypothesis:** In repeated oligopoly games, market shares converge to equal distribution (Nash Equilibrium).

**Setup:**
- 4 Tit-for-Tat teams (all using same strategy)
- 30 rounds, stable scenario
- Symmetric setup to test convergence

**Expected Learning:**
- Symmetric strategies lead to symmetric outcomes
- Market share equalizes over time (~25% each)
- Nash Equilibrium emerges from rational play
- Stability of equilibrium over many rounds

**Game Theory Concepts:** Nash Equilibrium, Symmetry, Convergence, Stability

---

### 5.5 Custom Experiment
**Purpose:** Students design their own experiments to test novel hypotheses.

**Pedagogical Value:**
- Encourages critical thinking and hypothesis formation
- Develops experimental design skills
- Enables exploration of unique strategic questions
- Promotes deeper engagement with game theory concepts

---

## 6. Assessment and Grading Rubric

### 6.1 Suggested Assignment Structure

**Assignment:** "Game Theory in Oligopoly Markets"

**Part 1: Hypothesis Formation (20%)**
- State a clear, testable hypothesis about strategic behavior
- Justify hypothesis with game theory reasoning
- Predict expected outcomes

**Part 2: Experimental Design (20%)**
- Select appropriate strategies and sample size
- Configure scenarios and market conditions
- Explain control and treatment variables

**Part 3: Data Collection (10%)**
- Run batch simulations in Research Lab
- Record statistical results (means, t-statistic, p-value, Cohen's d)
- Generate distribution charts

**Part 4: Statistical Analysis (30%)**
- Interpret t-test results and significance
- Assess effect size (practical vs. statistical significance)
- Analyze distribution charts (shape, outliers, variance)
- Evaluate whether hypothesis is supported

**Part 5: Business Implications (20%)**
- Explain findings in plain language
- Discuss real-world applications
- Identify limitations and caveats
- Suggest follow-up research questions

**Rubric Example:**

| Criterion | Excellent (4) | Proficient (3) | Developing (2) | Needs Work (1) |
|-----------|--------------|---------------|----------------|----------------|
| **Hypothesis** | Clear, testable, grounded in theory | Clear but lacking theoretical justification | Vague or not testable | Missing or nonsensical |
| **Experimental Design** | Controls identified, sample size justified | Basic design, some controls missing | Poor design, confounding variables | No clear design |
| **Statistical Interpretation** | Correctly interprets p-values, effect sizes, CIs | Basic interpretation, minor errors | Misinterprets some statistics | Fundamental misunderstandings |
| **Business Insight** | Actionable insights, limitations acknowledged | Basic insights, some limitations noted | Superficial insights | No practical application |

---

## 7. Technical Accuracy and Audit

### 7.1 Validation Testing

All economic calculations have been validated against:
- **Spreadsheet models:** Independent Excel/Google Sheets verification
- **Unit tests:** Automated test coverage for core game engine logic
- **Manual audits:** Calculation audit panel reviewed for sample scenarios
- **Edge case testing:** Bankruptcy, negative cash, extreme pricing scenarios

### 7.2 Known Limitations

1. **Simplified Economic Model**
   - Linear demand curves (reality is often non-linear)
   - No consumer heterogeneity (all consumers identical)
   - Perfect information (teams see all competitor data)
   - No entry/exit dynamics (fixed number of teams)

2. **Strategy AI Simplifications**
   - Deterministic decision rules (no true learning algorithms)
   - Limited state space (cannot model all possible contingencies)
   - No communication between teams (no explicit collusion)

3. **Statistical Limitations**
   - Synthetic data generation for distribution charts (not raw simulation data)
   - Assumes independence between games (scenarios randomized)
   - Limited to two-group comparisons (no ANOVA for >2 groups)

### 7.3 Recommended Use Cases

**Appropriate:**
- Teaching game theory concepts (Nash Equilibrium, Prisoner's Dilemma, etc.)
- Demonstrating statistical hypothesis testing
- Exploring strategic trade-offs in oligopoly markets
- Comparing cooperative vs. competitive strategies
- Classroom discussions and debates

**Not Appropriate:**
- Real-world market forecasting or business planning
- High-frequency trading strategy development
- Exact replication of specific industries (e.g., airlines, telecoms)
- PhD-level econometric research (use specialized tools like Stata, R)

---

## 8. Integration with Curriculum

### 8.1 Course Alignment

**Business Strategy (MBA/Undergraduate):**
- Module 4: Competitive Strategy and Game Theory
- Learning Objective: Apply game theory to analyze competitive dynamics
- Activity: Run Price War and Innovator Advantage experiments
- Assessment: Write 3-page analysis of findings

**Managerial Economics:**
- Module 6: Oligopoly Markets and Strategic Behavior
- Learning Objective: Understand Nash Equilibrium and collusion
- Activity: Nash Equilibrium Convergence experiment
- Assessment: Present findings to class

**Operations Management:**
- Module 3: Capacity Planning and Production Strategy
- Learning Objective: Evaluate capacity investment decisions
- Activity: Compare Capacity Leader vs. Premium strategies in Tournament Mode
- Assessment: Simulation report analyzing ROI of capacity expansion

**Corporate Finance:**
- Module 8: ESG and Long-Term Value Creation
- Learning Objective: Assess financial impact of ESG investments
- Activity: ESG Long-Term Value experiment
- Assessment: Investment memo recommending ESG strategy

### 8.2 Suggested Syllabus Entry

```
Week 7: Game Theory and Competitive Strategy
- Reading: Dixit & Nalebuff, "The Art of Strategy" (Chapters 4-5)
- Pre-Class: Review Strategy Lab Whitepaper (Section 2)
- In-Class: Lecture on Nash Equilibrium and Prisoner's Dilemma
- Lab Activity: Run Price War Experiment in Strategy Lab
- Homework: Complete statistical analysis worksheet
- Deliverable: 3-page experiment report (due Week 8)
```

---

## 9. Frequently Asked Questions

### 9.1 Educators

**Q: Is the simulation too complex for undergraduates?**
A: Generally not. The Visualizer mode aims to provide intuitive visual feedback, and Research Lab mode guides students through hypothesis testing with statistical outputs. Students with basic statistics knowledge (t-tests) should be able to complete experiments independently.

**Q: Can I customize the research questions?**
A: Yes. The "Custom Experiment" option allows you to configure any combination of strategies, scenarios, and game parameters. Advanced users can also save/export experiment configurations for reuse.

**Q: How long does it take to run an experiment?**
A: A 100-game experiment with 20 rounds takes approximately 2-3 minutes. Students can run multiple experiments in a single lab session.

**Q: Are results reproducible?**
A: Yes. The simulation seed controls scenario randomization. Using the same seed, team count, strategies, and parameters will produce identical results, enabling students to compare strategies under identical market conditions.

**Q: Can students export results for reports?**
A: Yes. Experiment results include statistical tables and distribution charts that can be screenshot or manually transcribed. (Future versions will support CSV/PDF export.)

### 9.2 Students

**Q: Do I need to understand coding to use Strategy Lab?**
A: No. The interface is entirely point-and-click. You select strategies from dropdown menus, configure parameters with sliders/inputs, and click "Run" to execute experiments.

**Q: What if my results don't match the expected outcome?**
A: Real experiments don't always confirm hypotheses! If results are unexpected:
1. Check sample size (increase to 100+ for more reliable results)
2. Review scenario settings (did you select the right scenario?)
3. Verify strategy assignments (did you choose the intended strategies?)
4. Consider alternative explanations (maybe your hypothesis needs revision!)

**Q: How do I cite Strategy Lab in my paper?**
A:
```
Strategy Lab [Computer software]. (2026). Bonopoly UAT.
https://yourdomain.com/strategy-lab
```

---

## 10. Conclusion

The **Strategy Lab** seeks to help transform game theory from abstract mathematics into an empirically testable simulation environment. By combining:
- **12 game-theoretic strategies** covering cooperative, aggressive, and adaptive archetypes
- **Statistical validation** with t-tests, effect sizes, and distribution analysis
- **Calculation auditing** for transparency and debugging
- **Pre-configured research questions** aligned with core MBA/undergraduate concepts

...educators may be able to provide students with hands-on experience in hypothesis-driven research, strategic analysis, and statistical reasoning—skills relevant for modern business education.

**For Academic Review:**
- Pedagogically designed: Aligned with Bloom's Taxonomy (Apply → Evaluate → Create)
- Statistically designed: Includes Welch's t-tests, Cohen's d effect sizes, 95% confidence intervals
- Technically implemented: Full P&L calculations, physics constraints, audit trails
- Flexible design: Supports custom experiments, saved configurations, tournament mode

**Suggested Next Steps:**
1. Consider reviewing this whitepaper with your curriculum committee
2. Optionally test-run the Price War experiment to evaluate fit
3. Review the Calculation Audit Panel for transparency
4. Consider integration into your syllabus as a lab activity or assignment

For questions, feedback, or partnership inquiries, contact: [Your Contact Information]

---

## Appendix A: Strategy Decision Rules

*(To be completed - detailed decision rules for each of the 12 strategies)*

---

## Appendix B: Mathematical Formulas

### B.1 Share Price Calculation

The share price calculation uses a sophisticated multi-factor model:

```
1. Calculate EPS (Earnings Per Share):
   EPS = Net Profit / Shares Outstanding

2. Calculate Growth Premium:
   rawPremium = (capacityGrowth × 0.10) + (shareGain × 0.10)
                + (brandScore × 0.08) + (cashScore × 0.04)
   growthPremium = clamp(rawPremium, -0.20, 0.35)

3. Calculate Quality Multiplier:
   profitMargin = netProfit / revenue
   ROE = netProfit / shareCapital
   qualityMultiplier = 1 + clamp((profitMargin × 0.5) + (ROE × 0.5) - 0.10, -0.15, 0.15)

4. Calculate Adjusted P/E Ratio:
   adjustedPE = basePE × (1 + growthPremium) × qualityMultiplier

5. Calculate Base Share Price:
   sharePriceBase = max(1, EPS × adjustedPE)

6. Apply Smoothing:
   smoothedPrice = (prevSharePrice × 0.45) + (sharePriceBase × 0.55)

7. Apply Debt Penalty:
   debtToAssets = totalDebt / totalAssets
   debtPenalty = progressive penalty based on debt/asset thresholds:
     - < 20%: no penalty
     - 20-40%: (debtToAssets - 0.20) × 0.5
     - > 40%: 0.10 + (debtToAssets - 0.40) × 1.0
   penalizedPrice = smoothedPrice × (1 - debtPenalty)

8. Apply Floor Protection:
   protectedFloor = prevSharePrice × (1 - maxDropPct)
   finalSharePrice = max(penalizedPrice, protectedFloor, 1)
```

### B.2 Market Share Calculation

```
Market Share = Team Units Sold / Total Market Demand

Where:
- Team Units Sold = sum of regional sales (US + Asia + Europe)
- Total Market Demand = sum of all teams' units sold across all regions
```

### B.3 Profit Calculation (Income Statement)

```
Revenue = sum of (units sold × price) across all regions

Cost of Goods Sold (COGS) = Material Costs + Labor Costs + Logistics + Outsourcing

Gross Profit = Revenue - COGS

Operating Expenses = R&D + Marketing + Administrative + HR

EBITDA = Gross Profit - Operating Expenses

EBIT = EBITDA - Depreciation

Profit Before Tax = EBIT - Interest Expense

Net Profit = Profit Before Tax - Tax
```

### B.4 Statistical Tests

**Welch's t-test (Two-Sample, Unequal Variances):**

```
t = (mean1 - mean2) / sqrt(s1²/n1 + s2²/n2)

Where:
- mean1, mean2 = sample means
- s1², s2² = sample variances
- n1, n2 = sample sizes

Degrees of freedom (Welch-Satterthwaite):
df = (s1²/n1 + s2²/n2)² / [(s1²/n1)²/(n1-1) + (s2²/n2)²/(n2-1)]
```

**Cohen's d (Effect Size):**

```
d = (mean1 - mean2) / pooledSD

pooledSD = sqrt[(s1² + s2²) / 2]

Interpretation:
- |d| > 0.8: Large effect
- 0.5 < |d| ≤ 0.8: Medium effect
- 0.2 < |d| ≤ 0.5: Small effect
- |d| ≤ 0.2: Negligible effect
```

**95% Confidence Interval:**

```
CI = (mean1 - mean2) ± t(0.025,df) × SE

Where:
- SE = sqrt(s1²/n1 + s2²/n2)
- t(0.025,df) = critical t-value at 2.5% (two-tailed)
```

**Bonferroni Correction (Available but not default):**

```
adjustedPValue = min(pValue × numComparisons, 1.0)

Used when: Multiple hypothesis tests are conducted simultaneously
Purpose: Controls family-wise error rate
```

### B.5 Box Plot Statistics

```
Q1 (First Quartile) = 25th percentile
Q2 (Median) = 50th percentile
Q3 (Third Quartile) = 75th percentile

IQR (Interquartile Range) = Q3 - Q1

Outliers = values < (Q1 - 1.5×IQR) OR values > (Q3 + 1.5×IQR)

Whiskers:
- Lower: min(non-outlier values)
- Upper: max(non-outlier values)
```

---

## Appendix C: Sample Student Assignment

*(To be completed - assignment template with grading rubric)*

---

## Appendix D: Troubleshooting Guide

*(To be completed - common issues and solutions)*

---

**Document History:**
- v1.0 (Jan 2026): Initial whitepaper for academic review

**Contributors:**
- Claude Sonnet 4.5 (AI Assistant)
- Bonopoly Development Team
