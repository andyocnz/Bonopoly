# Weights Lab: Share Price Reverse-Engineering (Full Version)

This document is the full, safe rewrite of the share‑price reverse‑engineering approach. It keeps the original intent (use real‑world data to infer weights), but fixes methodological pitfalls and clarifies what can and cannot be inferred.

---

## 1) What we’re trying to reverse‑engineer
Your game uses a growth premium to adjust share price based on weighted inputs like:
- Capacity growth
- Market share growth
- Brand change
- Cash growth

Goal: estimate **data‑driven weights** for these factors by regressing real‑world price changes on those inputs.

Important: **Baseline weights are never used in the regression**. We only use baseline weights **afterwards** to compare or scale the results.

---

## 2) What data you need (per company, per quarter)
### Outcome (y)
- **Stock Price Change** quarter‑over‑quarter (decimal).

### Inputs (X)
- **Capacity Growth** (proxy: CapEx growth or production capacity change)
- **Market Share Growth** (proxy: relative growth vs industry)
- **Brand Change** (proxy: Interbrand/Brand Finance changes)
- **Cash Growth** (QoQ change in cash & equivalents)

---

## 3) Data sources by factor (practical + auditable)
### Stock Price Change (Outcome)
- Yahoo Finance (historical prices)
- Alpha Vantage / Nasdaq Data Link

### Capacity Growth
- CapEx from 10‑Q / 10‑K (cash flow statement)
- Production capacity disclosures (industry‑specific)

### Market Share Growth
- Industry reports (IDC, Canalys, Gartner, Counterpoint)
- Company disclosures and industry size estimates

### Brand Change
- Interbrand and Brand Finance annual rankings
- Google Trends as a fallback proxy

### Cash Growth
- Quarterly balance sheets in 10‑Q / 10‑K

---

## 4) Data structure (CSV)
Example schema:

Company,Quarter,Price_Change,Capacity_Growth,MarketShare_Growth,Brand_Change,Cash_Growth,EPS
Apple,Q1 2023,0.211,0.15,0.28,0.05,0.126,1.88
Tesla,Q1 2023,0.684,0.35,0.18,0.12,-0.08,1.07
Samsung,Q1 2023,-0.123,0.05,-0.03,-0.02,0.03,0.44

Note: EPS is not part of the regression here unless you explicitly include it as a feature.

---

## 5) Key transformations (required)
- Convert all % to decimals (e.g., +21.1% → 0.211).
- Use consistent time windows (quarter‑over‑quarter).
- For brand change (annual), interpolate into quarters explicitly.
- For market share growth, use **relative growth vs industry**, not just raw share change.

---

## 6) Regression (safe version)
Standardize X, fit OLS or Ridge, then normalize coefficients by **sum of absolute values**.

### Python (safe baseline)
```python
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

# Load data
# Required columns:
# Price_Change, Capacity_Growth, MarketShare_Growth, Brand_Change, Cash_Growth

data = pd.read_csv('stock_data.csv')

feature_cols = [
    'Capacity_Growth',
    'MarketShare_Growth',
    'Brand_Change',
    'Cash_Growth'
]

X = data[feature_cols].astype(float).values
# Outcome (y)
y = data['Price_Change'].astype(float).values

# Standardize features only
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Ridge for stability (alpha=0.0 for OLS)
model = Ridge(alpha=0.25, fit_intercept=True)
model.fit(X_scaled, y)

coeffs = model.coef_

# Normalize by sum of absolute coefficients (preserves sign)
abs_sum = np.abs(coeffs).sum() or 1.0
normalized = coeffs / abs_sum

print('Raw coefficients:', coeffs)
print('Normalized weights (sum of abs = 1):')
for name, w in zip(feature_cols, normalized):
    print(f'{name:20s}: {w:+.2%}')

print('R^2:', model.score(X_scaled, y))
```

---

## 7) Comparing with baseline weights
- Baseline weights are design choices.
- Regression weights are empirical estimates.

To compare them on the same scale, map regression weights onto the baseline sum:

```
scaled_weight = abs(normalized_weight) * baseline_sum
```

Example:
- Baseline sum = 0.32
- Normalized coefficient for MarketShare_Growth = +0.48
- Scaled weight = 0.48 * 0.32 = 0.154

---

## 8) Interpreting results
- **Sign matters**: negative coefficient means the factor reduces price change.
- **R^2 will be modest**: stock price is influenced by many other factors.
- **Coefficient stability** across time windows is more meaningful than any single run.

---

## 9) Known risks and how to reduce them
- **Multicollinearity** (growth factors co‑move) → use ridge
- **Small samples** → more quarters, more companies
- **Proxy noise** → prefer consistent proxies, not perfect‑but‑rare data
- **Macro shocks** → consider adding time controls or running sensitivity checks

---

## 10) Recommended minimum dataset size
- **20–30 companies × 8–12 quarters = 160–360 rows**
- Anything below ~80 rows tends to be unstable

---

## 11) Output you should keep
- Coefficients (raw)
- Normalized coefficients (abs‑sum = 1)
- R^2
- Sample size

This is enough to justify and explain the calibration.

---

## 12) Bottom line
Yes, the approach is valid **if** you:
- standardize inputs,
- normalize coefficients by abs‑sum,
- preserve signs,
- keep data aligned,
- and interpret results cautiously.

This lets you say: “Our weights are calibrated to real market behavior,” while still preserving your design intent.

---

## Sources & References (plain text + URL)
- Yahoo Finance historical prices: https://finance.yahoo.com/
- Alpha Vantage API: https://www.alphavantage.co/
- Nasdaq Data Link (Quandl): https://data.nasdaq.com/
- SEC EDGAR filings: https://www.sec.gov/edgar/search/
- Interbrand Best Global Brands: https://interbrand.com/best-global-brands/
- Brand Finance reports: https://brandfinance.com/insights/reports
- Google Trends: https://trends.google.com/trends/
- Damodaran (Applied Corporate Finance / data): https://pages.stern.nyu.edu/~adamodar/
- OECD productivity manuals: https://www.oecd.org/industry/ind/oecdmanual-measuring-productivity.pdf
- McKinsey Global Institute (capital intensity): https://www.mckinsey.com/mgi
- IEA oil market report: https://www.iea.org/reports/oil-market-report
- OPEC monthly oil market report: https://www.opec.org/opec_web/en/publications/338.htm
- ACEA auto market data: https://www.acea.auto/
- IEA Global EV Outlook: https://www.iea.org/reports/global-ev-outlook
- SEMI industry reports: https://www.semi.org/
