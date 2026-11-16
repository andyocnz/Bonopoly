# WeightsLab Methodology

## Overview

WeightsLab calibrates game formula weights using real market data and regression analysis. It answers: *"Are our game's weights realistic compared to actual market behavior?"*

---

## The Regression Approach

### What We Do

1. **Collect real-world data** for the variables in our game formulas
2. **Run regression** to find which factors best predict the outcome (share price or market share)
3. **Normalize coefficients** to weights that sum to ~1.0
4. **Compare** model-derived weights to game baseline weights

### Regression Models

| Model | Formula | Use Case |
|-------|---------|----------|
| **OLS** | `β = (XᵀX)⁻¹Xᵀy` | Primary analysis; interpretable weights |
| **Ridge** | `β = (XᵀX + λI)⁻¹Xᵀy` | When features are correlated; reduces overfitting |

**R² (R-squared)** tells us how much of the outcome variation our features explain:
- 0.40-0.60 = Good for noisy real-world data
- > 0.70 = Excellent fit

---

## Part A: Share Price Calibration

### Game Formula

```
Growth_Premium =
  (capacity_growth      × w₁) +
  (market_share_growth  × w₂) +
  (brand_strength       × w₃) +
  (cash_strength        × w₄)

Share_Price = EPS × P/E × (1 + Growth_Premium)
```

### Data Collection

| Variable | Source | Method |
|----------|--------|--------|
| **Stock Price** | Yahoo Finance | Quarterly % change |
| **EPS** | SEC 10-Q/10-K filings | Reported GAAP EPS |
| **Cash Growth** | Balance sheets | (Cash_t - Cash_t-1) / Cash_t-1 |
| **Capacity Growth** | CapEx from cash flow statements | Proxy for production expansion |
| **Market Share Growth** | Industry reports + shipments | Relative position vs competitors |
| **Brand Change** | Interbrand + Google Trends | Annual valuations + quarterly interpolation |

### Companies in Dataset

- **Energy**: BP, ExxonMobil (XOM), Chevron (CVX)
- **Automotive**: Tesla (TSLA), Toyota (TM), General Motors (GM)
- **Technology**: Apple (AAPL), Samsung (005930.KS), Sony

### Expected Results

Typical R² for share price: **0.40-0.65** (stock prices have significant noise from macro factors, sentiment, etc.)

---

## Part B: Market Share Calibration

### Game Formula

```
Attractiveness =
  (price_score     × w₁) +
  (quality_score   × w₂) +
  (features_score  × w₃) +
  (marketing_score × w₄) +
  (csr_score       × w₅) +
  (training_score  × w₆)
```

### Data Collection

| Variable | Source | Method |
|----------|--------|--------|
| **Market Share** | IDC, Canalys quarterly reports | Shipment-based % |
| **Price Index** | ASP data, financial filings | Relative positioning (higher = more competitive) |
| **Quality Score** | Reviews, reliability data | Brand-level perception (0-100) |
| **Features Count** | Product specs, GSMArena | Breadth of capabilities |
| **Marketing %** | Annual reports, analyst estimates | Marketing spend as % of revenue |
| **CSR Score** | CDP climate scores | Environmental disclosure rating (0-100) |
| **Training Score** | ESG reports, workforce disclosures | Human capital investment proxy |

### Companies in Dataset

Global smartphone brands: **Apple, Samsung, Xiaomi, OPPO, vivo**

### Regional Weights

The game uses different weights by region because consumer preferences vary:

| Factor | US | Asia | Europe |
|--------|-----|------|--------|
| Price | 22% | 40% | 18% |
| Quality | 25% | 17% | 25% |
| Features | 28% | 28% | 22% |
| Marketing | 5% | 5% | 10% |
| CSR | 15% | 5% | 25% |
| Training | 5% | 5% | 5% |

### Expected Results

Typical R² for market share: **0.60-0.85** (competitive dynamics are more deterministic than stock prices)

---

## Normalization

### Why Normalize?

Raw regression coefficients have arbitrary scale. We normalize to make them comparable:

```
normalized_weight[i] = |coefficient[i]| / Σ|coefficients|
```

This converts coefficients to weights that sum to 1.0 (100%).

### Scaling to Baseline

To compare with game weights (which may not sum to 1.0), we scale:

```
suggested_weight = normalized_weight × baseline_sum
```

Example: If baseline sums to 0.32 and model says feature should be 25% of total:
- Suggested = 0.25 × 0.32 = **0.08**

---

## Limitations

1. **Correlation ≠ Causation**: Regression shows what *predicts* outcomes, not what *causes* them
2. **Sample Size**: Limited companies and quarters mean estimates have uncertainty
3. **Proxy Variables**: Some factors (brand, capacity) are estimated, not directly measured
4. **Absolute Values**: We use |coefficients| to avoid negative weights, which loses sign information

---

## Data Sources & References

### A. Market Share Data (Primary Sources)

Authoritative sources for quarterly global smartphone market share.

| Source | URL | What You Get |
|--------|-----|--------------|
| **IDC Quarterly Mobile Phone Tracker** | https://www.idc.com/getdoc.jsp?containerId=prUS | Global shipment-based market share (industry benchmark) |
| **Canalys Global Smartphone Reports** | https://www.canalys.com/newsroom | Cross-check and fallback where IDC detail is limited |
| **Counterpoint Research** | https://www.counterpointresearch.com/insights/ | Brand-level ASP trends, premium vs mid-range segmentation |
| **Statista Smartphone Data** | https://www.statista.com/markets/418/topic/482/smartphones/ | Secondary confirmation of market trends |

### B. Stock Price & Financial Data

| Source | URL | What You Get |
|--------|-----|--------------|
| **Yahoo Finance** | https://finance.yahoo.com | Historical stock prices (daily/quarterly), free API |
| **SEC EDGAR** | https://www.sec.gov/edgar/search/ | 10-K, 10-Q filings for US companies |
| **Alpha Vantage** | https://www.alphavantage.co | Stock prices + fundamentals via API (free tier) |

### C. Company Investor Relations

| Company | Investor Relations URL |
|---------|------------------------|
| **Apple** | https://investor.apple.com |
| **Samsung** | https://www.samsung.com/global/ir/ |
| **Xiaomi** | https://www.mi.com/global/investor-relations |
| **Toyota** | https://global.toyota/en/ir/ |
| **Sony** | https://www.sony.com/en/SonyInfo/IR/ |
| **Tesla** | https://ir.tesla.com |

### D. Brand Valuation

| Source | URL | What You Get |
|--------|-----|--------------|
| **Interbrand Best Global Brands** | https://interbrand.com/best-global-brands/ | Annual brand value rankings (primary) |
| **Brand Finance** | https://brandfinance.com/insights/reports | Brand value estimates (secondary) |
| **Google Trends** | https://trends.google.com/trends/ | Search interest as quarterly proxy |

### E. Quality & Features Data

| Source | URL | What You Get |
|--------|-----|--------------|
| **GSMArena** | https://www.gsmarena.com | Detailed phone specs, feature database |
| **TechRadar** | https://www.techradar.com/phones | Expert quality scores, reviews |
| **Android Authority** | https://www.androidauthority.com | Long-term device & ecosystem analysis |
| **Consumer Reports** | https://www.consumerreports.org/electronics/ | Brand reliability ratings |
| **DxOMark** | https://www.dxomark.com | Camera/display quality scores |

### F. CSR / ESG Scores

| Source | URL | What You Get |
|--------|-----|--------------|
| **CDP (Carbon Disclosure Project)** | https://www.cdp.net/en/companies | Climate disclosure ratings (primary) |
| **MSCI ESG Ratings** | https://www.msci.com/our-solutions/esg-investing | ESG scores by company |
| **Sustainalytics** | https://www.sustainalytics.com | ESG risk ratings |

### G. Corporate Sustainability Reports

| Company | Sustainability URL |
|---------|-------------------|
| **Apple** | https://www.apple.com/environment/ |
| **Samsung** | https://www.samsung.com/global/sustainability/ |
| **Xiaomi** | https://www.mi.com/global/sustainability |
| **OPPO** | https://www.oppo.com/en/sustainability/ |
| **vivo** | https://www.vivo.com/en/sustainability |

### H. Industry Reports (Sector-Specific)

**Energy:**
| Source | URL |
|--------|-----|
| IEA Oil Market Reports | https://www.iea.org/reports/oil-market-report |
| OPEC Monthly Oil Market Report | https://www.opec.org/opec_web/en/publications/338.htm |

**Automotive:**
| Source | URL |
|--------|-----|
| ACEA (European Auto Association) | https://www.acea.auto/ |
| IEA Global EV Outlook | https://www.iea.org/reports/global-ev-outlook |

**Technology:**
| Source | URL |
|--------|-----|
| SEMI Industry Reports | https://www.semi.org/ |
| Gartner | https://www.gartner.com |

### I. Macro & Economic Context

| Source | URL | Use |
|--------|-----|-----|
| **World Bank Global Economic Prospects** | https://www.worldbank.org/en/publication/global-economic-prospects | COVID-19 shock anchoring |
| **FRED (Federal Reserve)** | https://fred.stlouisfed.org | Economic indicators |

---

## Variable Classification

### Share Price Dataset

| Variable | Classification | Auditability |
|----------|----------------|--------------|
| EPS | Observed | Fully verifiable against public filings |
| Cash Growth | Calculated (Observed) | Fully reproducible |
| Capacity Growth | Derived Proxy (CapEx) | Standard practice in capital-intensive analysis |
| Market Share Growth | Estimated | Assumptions documented |
| Brand Change | Proxied (Latent) | Directional signal, not absolute value |

### Market Share Dataset

| Variable | Classification | Auditability |
|----------|----------------|--------------|
| Market Share | Observed | IDC/Canalys quarterly reports |
| Price Index | Calculated | ASP data, normalized quarterly |
| Quality Score | Aggregated Proxy | Brand-level perception (0-100) |
| Features Count | Observed | Product specs from official sources |
| Marketing % | Estimated | SG&A disclosures + analyst estimates |
| CSR Score | Observed | CDP public scores |
| Training Score | Estimated | ESG workforce disclosures |

---

### Citation Note

When presenting results:

> *"Weights derived from OLS/Ridge regression analysis of 2023-2024 quarterly data from public company filings (SEC EDGAR), industry analysts (IDC, Canalys), and sustainability disclosures (CDP)."*

---

## Quick Reference

### Running the Analysis

1. Load dataset (CSV or default)
2. Select target variable and features
3. Set ridge strength (λ = 0.25 default)
4. View OLS and Ridge results
5. Compare to game baseline

### Interpreting Results

| If Model Weight... | Then Consider... |
|--------------------|------------------|
| Much higher than baseline | Increase game weight |
| Much lower than baseline | Decrease game weight |
| Similar to baseline | Current weight is realistic |

### Files

- **Dataset (Share Price)**: `/weights-lab/merged_dataset.csv`
- **Dataset (Market Share)**: `/weights-lab/market_share_dataset.csv`
- **Game Weights**: `src/engine/gameEngine.ts` → `GAME_CONFIG`
