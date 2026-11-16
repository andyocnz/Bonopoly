import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.split('=')
  return [key, value ?? '']
}))

const years = Number(args.get('--years') ?? '10')
const interval = args.get('--interval') ?? '1mo'
const outputPath = args.get('--output') ?? 'weights-lab/data/output/quarterly_prices.csv'
const configPath = args.get('--config') ?? 'weights-lab/config/tickers.json'
const delayMs = Number(args.get('--delay') ?? '250')
const useAdjClose = (args.get('--adjclose') ?? 'true') !== 'false'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type TickerEntry = { ticker: string; name: string }

type IndustryConfig = { id: string; label: string; tickers: TickerEntry[] }

type TickerConfig = { industries: IndustryConfig[] }

function toQuarterKey(date: Date): string {
  const year = date.getUTCFullYear()
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1
  return `${year}Q${quarter}`
}

function safeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (Number.isNaN(value)) return null
  return value
}

async function fetchYahooChart(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${years}y&events=div%2Csplit`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BonopolyWeightsLab/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`Yahoo request failed for ${ticker} (${response.status})`)
  }

  const data = await response.json()
  return data as unknown
}

type YahooChartLike = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>
        adjclose?: Array<{ adjclose?: Array<number | null> }>
      }
    }>
  }
}

function extractQuarterlyPrices(raw: unknown, preferAdjClose: boolean): { quarter: string; close: number }[] {
  const parsed = raw as YahooChartLike
  const result = parsed.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0]
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose
  const closes: Array<number | null> = (preferAdjClose && Array.isArray(adjClose)) ? adjClose : quote?.close

  if (!timestamps.length || !closes?.length) return []

  const quarterMap = new Map<string, { timestamp: number; close: number }>()

  for (let i = 0; i < timestamps.length; i += 1) {
    const close = safeNumber(closes[i])
    if (close === null) continue
    const timestamp = timestamps[i] * 1000
    const date = new Date(timestamp)
    const quarter = toQuarterKey(date)
    const existing = quarterMap.get(quarter)
    if (!existing || timestamp > existing.timestamp) {
      quarterMap.set(quarter, { timestamp, close })
    }
  }

  return Array.from(quarterMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([quarter, value]) => ({ quarter, close: value.close }))
}

async function main() {
  const configRaw = await readFile(configPath, 'utf-8')
  const config = JSON.parse(configRaw) as TickerConfig
  const rows: Array<Record<string, string>> = []

  for (const industry of config.industries) {
    for (const entry of industry.tickers) {
      const raw = await fetchYahooChart(entry.ticker)
      const quarterly = extractQuarterlyPrices(raw, useAdjClose)
      let prevClose: number | null = null

      for (const point of quarterly) {
        const priceChange = prevClose === null ? '' : ((point.close / prevClose) - 1).toFixed(6)
        rows.push({
          ticker: entry.ticker,
          company: entry.name,
          industry: industry.id,
          quarter: point.quarter,
          close: point.close.toFixed(4),
          price_change: priceChange
        })
        prevClose = point.close
      }

      await sleep(delayMs)
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })

  const header = ['ticker', 'company', 'industry', 'quarter', 'close', 'price_change']
  const content = [header.join(',')]
  for (const row of rows) {
    content.push(header.map((key) => row[key] ?? '').join(','))
  }
  await writeFile(outputPath, `${content.join('\n')}\n`, 'utf-8')
  console.log(`Saved ${rows.length} rows to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
