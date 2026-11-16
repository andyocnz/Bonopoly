import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { parseCsv, toCsv } from './lib/csv'

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.split('=')
  return [key, value ?? '']
}))

const pricesPath = args.get('--prices') ?? 'weights-lab/data/output/quarterly_prices.csv'
const metricsPath = args.get('--metrics')
const outputPath = args.get('--output') ?? 'weights-lab/data/output/merged_dataset.csv'

if (!metricsPath) {
  console.error('Missing --metrics=path/to/metrics.csv')
  process.exit(1)
}

const normalize = (value: string) => value.trim().toLowerCase()

async function main() {
  const pricesRaw = await readFile(pricesPath, 'utf-8')
  const metricsRaw = await readFile(metricsPath, 'utf-8')
  const prices = parseCsv(pricesRaw)
  const metrics = parseCsv(metricsRaw)

  const priceByKey = new Map<string, Record<string, string>>()
  for (const row of prices.rows) {
    const ticker = row.ticker || row.company
    const quarter = row.quarter
    if (!ticker || !quarter) continue
    const key = `${normalize(ticker)}__${normalize(quarter)}`
    priceByKey.set(key, row)
  }

  const outputRows: Record<string, string>[] = []
  for (const row of metrics.rows) {
    const company = row.company || row.ticker
    const quarter = row.quarter
    if (!company || !quarter) continue
    const key = `${normalize(company)}__${normalize(quarter)}`
    const priceRow = priceByKey.get(key)
    if (!priceRow) continue

    outputRows.push({
      ...row,
      price_change: priceRow.price_change ?? '',
      close: priceRow.close ?? '',
      industry: priceRow.industry ?? row.industry ?? ''
    })
  }

  if (!outputRows.length) {
    console.error('No rows matched between metrics and prices. Check company/ticker + quarter format.')
    process.exit(1)
  }

  const header = Array.from(
    new Set([
      ...metrics.header,
      'price_change',
      'close',
      'industry'
    ])
  )

  await mkdir(path.dirname(outputPath), { recursive: true })
  const csv = toCsv(outputRows, header)
  await writeFile(outputPath, csv, 'utf-8')
  console.log(`Saved ${outputRows.length} rows to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
