import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { parseCsv } from './lib/csv'
import { regress, standardize } from './lib/regression'

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.split('=')
  return [key, value ?? '']
}))

const datasetPath = args.get('--dataset') ?? 'weights-lab/data/output/merged_dataset.csv'
const outputPath = args.get('--output') ?? 'weights-lab/data/output/model_results.json'
const targetField = args.get('--target') ?? 'price_change'
const featureFields = (args.get('--features') ?? 'capacity_growth,market_share_growth,brand_change,cash_growth')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const ridgeLambda = Number(args.get('--ridge') ?? '0.25')

const toNumber = (value: string) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeWeights(coefficients: number[]) {
  const total = coefficients.reduce((sum, value) => sum + Math.abs(value), 0) || 1
  return coefficients.map((value) => value / total)
}

async function main() {
  const raw = await readFile(datasetPath, 'utf-8')
  const { rows } = parseCsv(raw)

  const features: number[][] = []
  const targets: number[] = []

  for (const row of rows) {
    const target = toNumber(row[targetField])
    if (target === null) continue

    const featureRow: number[] = []
    let valid = true
    for (const field of featureFields) {
      const value = toNumber(row[field])
      if (value === null) {
        valid = false
        break
      }
      featureRow.push(value)
    }
    if (!valid) continue

    features.push(featureRow)
    targets.push(target)
  }

  if (!features.length) {
    console.error('No valid rows found. Check your dataset and feature names.')
    process.exit(1)
  }

  const { scaled } = standardize(features)
  const ols = regress(scaled, targets, 0)
  const ridge = regress(scaled, targets, ridgeLambda)

  const output = {
    meta: {
      dataset: datasetPath,
      targetField,
      featureFields,
      rows: features.length,
      ridgeLambda
    },
    ols: {
      coefficients: ols.coefficients,
      intercept: ols.intercept,
      r2: ols.r2,
      normalized: normalizeWeights(ols.coefficients)
    },
    ridge: {
      coefficients: ridge.coefficients,
      intercept: ridge.intercept,
      r2: ridge.r2,
      normalized: normalizeWeights(ridge.coefficients)
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Saved model results to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
