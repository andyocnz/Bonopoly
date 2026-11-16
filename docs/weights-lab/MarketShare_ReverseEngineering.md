# Weights Lab: Market Share Reverse-Engineering (Full Version)

This document is the full, safe rewrite of the market share reverse‑engineering approach. It keeps the original intent (use real‑world data to infer weights), but fixes methodological pitfalls and clarifies what can and cannot be inferred.

---

## 1) What we’re trying to reverse‑engineer
Your game calculates market share from weighted factors such as:
- Price competitiveness
- Quality / tech score
- Feature breadth
- Promotion / marketing intensity
- CSR / sustainability
- Training / workforce quality

Goal: estimate **data‑driven weights** for these factors by regressing real‑world market share on those inputs.

Important: **Baseline weights are never used in the regression**. We only use baseline weights **afterwards** to compare or scale the results.

---

## 2) What data you need (per company, per quarter, per region)
### Outcome (y)
- **Market Share** by company, region, and quarter (decimal, e.g., 0.165 not 16.5%).

### Inputs (X)
- **Price Index** (relative price competitiveness)
- **Quality Score** (normalized quality proxy)
- **Features Count** (feature breadth)
- **Marketing %** (promotion intensity proxy)
- **CSR Score** (ESG or sustainability proxy)
- **Training Score** (workforce quality proxy)

---

## 3) Data sources by factor (practical + auditable)
You can use any source that is consistent quarter‑to‑quarter. Prefer public sources for auditability.

### Market Share (Outcome)
- Industry trackers: IDC, Canalys, Counterpoint (public summaries)
- Company filings (investor decks / IR reports)
- SEC filings (rarely give absolute share but sometimes give rank/region share)

### Price Index
- Average selling price (ASP) trends by brand or category
- Product pricing from public retail channels (Amazon, GSMArena, etc.)
- Construct **Price_Index = market_avg_price / company_price** (so higher means more competitive)

### Quality / Features
- Expert review aggregates (DxOMark, GSMArena, TechRadar)
- Normalized into a 0–100 score
- Features count can be raw count or percentile by quarter

### Marketing %
- Company filings: SG&A discussion, marketing % of revenue (if disclosed)
- Ad spend trackers (Kantar, eMarketer) if available

### CSR / Sustainability
- CDP scores, MSCI ESG, Sustainalytics, or company ESG reports
- Normalize to 0–100

### Training / Workforce quality
- Company training disclosures (ESG or annual reports)
- External rankings (Great Place to Work, LinkedIn skills distribution)
- Normalize to 0–100

---

## 4) Data structure (CSV)
Example schema:

Company,Quarter,Region,Market_Share,Price_Index,Quality_Score,Features_Count,Marketing_Pct,CSR_Score,Training_Score
Apple,Q1 2023,Asia,0.165,0.72,95,18,0.021,90,78
Samsung,Q1 2023,Asia,0.182,0.81,88,16,0.038,75,72
Xiaomi,Q1 2023,Asia,0.138,1.08,78,14,0.045,60,65

---

## 5) Key transformations (required)
- **Market_Share** must be decimal (0–1).
- **Price_Index** should be defined so higher means *more competitive*.
- **Quality / CSR / Training** should be normalized to common scale (0–100 or z‑score).
- **Features_Count** can be raw, but normalize by quarter for comparability.
- **Marketing_Pct** should be percent of revenue, not raw dollars.

Why: if you mix raw dollars with percent changes, the regression is dominated by scale and becomes meaningless.

---

## 6) Regression (safe version)
We standardize X, fit OLS or Ridge, then normalize coefficients by **sum of absolute values**.

### Python (safe baseline)
```python
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

# Load data
# Required columns:
# Region, Quarter, Market_Share, Price_Index, Quality_Score,
# Features_Count, Marketing_Pct, CSR_Score, Training_Score

data = pd.read_csv('market_data.csv')

# Filter by region (example)
region = 'Asia'
region_data = data[data['Region'] == region].copy()

feature_cols = [
    'Price_Index',
    'Quality_Score',
    'Features_Count',
    'Marketing_Pct',
    'CSR_Score',
    'Training_Score'
]

X = region_data[feature_cols].astype(float).values
# Outcome (y)
y = region_data['Market_Share'].astype(float).values

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
    print(f'{name:16s}: {w:+.2%}')

print('R^2:', model.score(X_scaled, y))
```

---

## 7) Comparing with baseline weights
- Regression weights are **data‑driven**.
- Baseline weights are **design‑driven**.

To compare them on the same scale, map regression weights onto the baseline sum:

```
scaled_weight = abs(normalized_weight) * baseline_sum
```

Example:
- Baseline sum = 0.32
- Normalized coefficient for Price_Index = +0.40
- Scaled weight = 0.40 * 0.32 = 0.128

---

## 8) Interpreting results
- **Sign matters**: negative coefficient means the factor reduces market share.
- **R^2 will be modest**: other forces (brand power, channel dynamics, supply shocks) matter.
- **Stable coefficients across regions** are more trustworthy than single‑region estimates.

---

## 9) Known risks and how to reduce them
- **Multicollinearity** (price and quality often move together) → use ridge
- **Small samples** → add more quarters or companies
- **Proxy noise** → prefer consistently available data over “perfect” but sparse data
- **Temporal mismatch** → align all features and market share to the same quarter

---

## 10) Recommended minimum dataset size
- **10 companies × 8 quarters × 3 regions = 240 rows**
- Anything below ~80 rows tends to be unstable

---

## 11) Output you should keep
For each region:
- Coefficients (raw)
- Normalized coefficients (abs‑sum = 1)
- R^2
- Sample size

That’s enough to justify or update game weights transparently.

---

## 12) Bottom line
Yes, the approach is valid **if** you:
- standardize inputs,
- normalize coefficients by abs‑sum,
- preserve signs,
- keep data aligned,
- and interpret results cautiously.

This lets you say: “Our weights are calibrated to real market share behavior,” and show the data‑driven comparison to the baseline.

---

## Sources & References (plain text + URL)
- IDC press releases (Worldwide Quarterly Mobile Phone Tracker): https://www.idc.com/getdoc.jsp?containerId=prUS
- Canalys newsroom: https://www.canalys.com/newsroom
- Counterpoint Research insights: https://www.counterpointresearch.com/insights/
- Statista smartphones topic (ASP/market data): https://www.statista.com/markets/418/topic/482/smartphones/
- GSMArena device database: https://www.gsmarena.com/
- DxOMark scores: https://www.dxomark.com/
- TechRadar phone reviews: https://www.techradar.com/phones
- Android Authority: https://www.androidauthority.com/
- Apple investor relations: https://investor.apple.com/
- Samsung investor relations: https://www.samsung.com/global/ir/
- Xiaomi investor relations: https://www.mi.com/global/investor-relations
- OPPO sustainability: https://www.oppo.com/en/sustainability/
- vivo sustainability: https://www.vivo.com/en/sustainability/
- CDP (Carbon Disclosure Project): https://www.cdp.net/en/companies
