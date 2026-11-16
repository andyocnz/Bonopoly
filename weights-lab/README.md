# Weights Lab (Share Price Calibration)

This folder contains a standalone, end-to-end pipeline that:
1) pulls quarterly share-price changes for a set of tickers,
2) merges with your manual growth metrics,
3) runs regression + ridge, and
4) outputs normalized weights for comparison to your game formula.

## Folder Layout
- `config/tickers.json` — industries + tickers
- `data/templates/metrics_template.csv` — manual metrics format
- `data/templates/dataset_sample.csv` — small sample dataset (for UI testing)
- `data/output/` — generated outputs
- `scripts/` — data fetch + merge + model

## 1) Fetch Quarterly Prices (Yahoo)

```bash
npx tsx weights-lab/scripts/fetch_prices.ts --years=10 --interval=1mo
```

Outputs: `weights-lab/data/output/quarterly_prices.csv`

Columns:
- `ticker`, `company`, `industry`, `quarter`, `close`, `price_change`

## 2) Prepare Manual Metrics

Use `weights-lab/data/templates/metrics_template.csv` as the format.
Required columns:
- `company` (or `ticker`)
- `quarter` (format `YYYYQ1..Q4`)
- `capacity_growth`, `market_share_growth`, `brand_change`, `cash_growth`, `eps`

## 3) Merge Prices + Metrics

```bash
npx tsx weights-lab/scripts/merge_dataset.ts --metrics=PATH_TO_METRICS.csv
```

Outputs: `weights-lab/data/output/merged_dataset.csv`

## 4) Run Models

```bash
npx tsx weights-lab/scripts/run_models.ts --dataset=weights-lab/data/output/merged_dataset.csv
```

Outputs: `weights-lab/data/output/model_results.json`

Optional args:
- `--target=price_change`
- `--features=capacity_growth,market_share_growth,brand_change,cash_growth`
- `--ridge=0.25`

## Frontend Demo

Open `/weights-lab` in the app. Upload your `merged_dataset.csv` and compare the output
weights vs the game’s current 10/10/8/4 baseline.
