import { useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { authApi } from '../api/client'
import { GAME_CONFIG } from '../engine/gameEngine'
import './WeightsLabPage.css'

// Helper to get share price baseline weights from game engine config
function getSharePriceBaseline(): Record<string, number> {
  const weights = GAME_CONFIG.financial.growthPremiumWeights
  return {
    capacity_growth: weights.capacity,
    market_share_growth: weights.share,
    brand_change: weights.brand,
    cash_growth: weights.cash
  }
}

const MODES = {
  sharePrice: {
    id: 'sharePrice',
    label: 'Share Price',
    targetField: 'price_change',
    defaultFeatures: ['capacity_growth', 'market_share_growth', 'brand_change', 'cash_growth'],
    baselineWeights: null as Record<string, number> | null, // Dynamically loaded via getSharePriceBaseline()
    expectedColumns: 'company, quarter, price_change, capacity_growth, market_share_growth, brand_change, cash_growth, eps, industry',
    defaultDataset: '/weights-lab/merged_dataset.csv',
    templateDownload: '/weights-lab/templates/share_price_template.csv'
  },
  marketShare: {
    id: 'marketShare',
    label: 'Market Share',
    targetField: 'market_share',
    defaultFeatures: ['price_index', 'quality_score', 'features_count', 'marketing_pct', 'csr_score', 'training_score'],
    baselineWeights: null as Record<string, number> | null,
    expectedColumns: 'company, quarter, region, market_share, price_index, quality_score, features_count, marketing_pct, csr_score, training_score',
    defaultDataset: '/weights-lab/market_share_dataset.csv',
    templateDownload: '/weights-lab/templates/market_share_template.csv'
  }
}


const METHODOLOGY_SNIPPETS = {
  sharePrice: {
    title: 'Share Price Methodology (Summary)',
    points: [
      'EPS and cash are observed from quarterly filings (GAAP for US, IFRS equivalent for intl).',
      'Capacity growth uses CapEx as a proxy for expansion or contraction.',
      'Market share growth is estimated from operational indicators (shipments, deliveries, sales volumes).',
      'Brand change is proxied from annual brand valuations and search-interest trends.'
    ]
  },
  marketShare: {
    title: 'Market Share Methodology (Summary)',
    points: [
      'Global quarterly market share comes from public IDC/Canalys releases with conservative interpolation.',
      'Price index reflects relative ASP positioning, not absolute prices.',
      'Quality/features/marketing/CSR/training are normalized within each quarter for comparability.',
      'Metrics are strategic proxies, not accounting-grade measures.'
    ]
  }
} as const

type ModeKey = keyof typeof MODES

type CsvRow = Record<string, string>

type ParsedCsv = {
  header: string[]
  rows: CsvRow[]
}

type ModelResult = {
  coefficients: number[]
  intercept: number
  r2: number
  normalized: number[]
}

type AnalysisResult = {
  ols: ModelResult
  ridge: ModelResult
  rowsUsed: number
  warning?: string
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let current: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        value += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      current.push(value)
      value = ''
      continue
    }

    if (char === '\n') {
      current.push(value)
      value = ''
      if (current.length > 1 || current[0].trim() !== '') {
        rows.push(current)
      }
      current = []
      continue
    }

    if (char === '\r') {
      continue
    }

    value += char
  }

  if (value.length > 0 || current.length > 0) {
    current.push(value)
    rows.push(current)
  }

  const header = (rows.shift() ?? []).map((h) => h.trim())
  const mappedRows = rows
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const record: CsvRow = {}
      header.forEach((key, idx) => {
        record[key] = (row[idx] ?? '').trim()
      })
      return record
    })

  return { header, rows: mappedRows }
}

function standardize(features: number[][]) {
  const rows = features.length
  const cols = features[0]?.length ?? 0
  const means = Array(cols).fill(0)
  const stds = Array(cols).fill(0)

  for (let j = 0; j < cols; j += 1) {
    let sum = 0
    for (let i = 0; i < rows; i += 1) sum += features[i][j]
    means[j] = sum / rows
  }

  for (let j = 0; j < cols; j += 1) {
    let variance = 0
    for (let i = 0; i < rows; i += 1) {
      const diff = features[i][j] - means[j]
      variance += diff * diff
    }
    stds[j] = Math.sqrt(variance / rows) || 1
  }

  const scaled = features.map((row) => row.map((value, j) => (value - means[j]) / stds[j]))
  return { scaled }
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]))
}

function multiply(a: number[][], b: number[][]): number[][] {
  const result = Array(a.length)
    .fill(0)
    .map(() => Array(b[0].length).fill(0))
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      for (let j = 0; j < b[0].length; j += 1) {
        result[i][j] += a[i][k] * b[k][j]
      }
    }
  }
  return result
}

function invert(matrix: number[][]): number[][] {
  const n = matrix.length
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])

  for (let i = 0; i < n; i += 1) {
    let pivot = augmented[i][i]
    if (Math.abs(pivot) < 1e-12) {
      let swapRow = -1
      for (let r = i + 1; r < n; r += 1) {
        if (Math.abs(augmented[r][i]) > 1e-12) {
          swapRow = r
          break
        }
      }
      if (swapRow === -1) throw new Error('Matrix is singular')
      const temp = augmented[i]
      augmented[i] = augmented[swapRow]
      augmented[swapRow] = temp
      pivot = augmented[i][i]
    }

    for (let j = 0; j < 2 * n; j += 1) {
      augmented[i][j] /= pivot
    }

    for (let r = 0; r < n; r += 1) {
      if (r === i) continue
      const factor = augmented[r][i]
      for (let c = 0; c < 2 * n; c += 1) {
        augmented[r][c] -= factor * augmented[i][c]
      }
    }
  }

  return augmented.map((row) => row.slice(n))
}

function addRidge(matrix: number[][], lambda: number): number[][] {
  return matrix.map((row, i) => row.map((value, j) => (i === j ? value + lambda : value)))
}

function regress(features: number[][], target: number[], ridgeLambda = 0): ModelResult {
  const rows = features.length
  const X = features.map((row) => [1, ...row])
  const y = target.map((value) => [value])

  const Xt = transpose(X)
  const XtX = multiply(Xt, X)
  const XtXAdjusted = ridgeLambda > 0 ? addRidge(XtX, ridgeLambda) : XtX
  const XtXInv = invert(XtXAdjusted)
  const XtY = multiply(Xt, y)
  const beta = multiply(XtXInv, XtY).map((row) => row[0])

  const intercept = beta[0]
  const coefficients = beta.slice(1)

  const meanY = target.reduce((sum, value) => sum + value, 0) / rows
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < rows; i += 1) {
    const prediction = intercept + coefficients.reduce((sum, coef, j) => sum + coef * features[i][j], 0)
    const diff = target[i] - prediction
    ssRes += diff * diff
    const diffMean = target[i] - meanY
    ssTot += diffMean * diffMean
  }

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  const totalWeight = coefficients.reduce((sum, value) => sum + Math.abs(value), 0) || 1
  const normalized = coefficients.map((value) => value / totalWeight)

  return { coefficients, intercept, r2, normalized }
}


function getDefaultRegion(rows: CsvRow[]) {
  const regions = rows.map((row) => row.region).filter(Boolean) as string[]
  if (!regions.length) return 'Global'
  const unique = Array.from(new Set(regions))
  const global = unique.find((value) => value.toLowerCase() == 'global')
  return global ?? unique[0]
}

function toNumber(value: string | undefined) {
  if (!value) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}


function renderMarkdown(source: string) {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = escaped.split(/\r?\n/)
  const html: string[] = []
  let inList = false
  let inCodeBlock = false
  let inTable = false

  // Helper to process inline formatting (bold, italic, code)
  function processInline(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // **bold**
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')              // *italic*
      .replace(/`([^`]+)`/g, '<code>$1</code>')            // `code`
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (inList) { html.push('</ul>'); inList = false }
      if (inCodeBlock) {
        html.push('</pre>')
        inCodeBlock = false
      } else {
        html.push('<pre class="weights-md-code">')
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      html.push(line + '\n')
      continue
    }

    // Tables
    if (line.startsWith('|') && line.endsWith('|')) {
      if (inList) { html.push('</ul>'); inList = false }
      const cells = line.slice(1, -1).split('|').map(c => c.trim())

      // Check if this is a separator row (| --- | --- |)
      if (cells.every(c => /^-+$/.test(c))) {
        continue // Skip separator row
      }

      if (!inTable) {
        html.push('<table class="weights-md-table"><thead><tr>')
        cells.forEach(cell => html.push(`<th>${processInline(cell)}</th>`))
        html.push('</tr></thead><tbody>')
        inTable = true
      } else {
        html.push('<tr>')
        cells.forEach(cell => html.push(`<td>${processInline(cell)}</td>`))
        html.push('</tr>')
      }
      continue
    }
    if (inTable && !line.startsWith('|')) {
      html.push('</tbody></table>')
      inTable = false
    }

    // Headers (check longest first)
    if (line.startsWith('#### ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h5>${processInline(line.slice(5))}</h5>`)
      continue
    }
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h4>${processInline(line.slice(4))}</h4>`)
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h3>${processInline(line.slice(3))}</h3>`)
      continue
    }
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h2>${processInline(line.slice(2))}</h2>`)
      continue
    }
    if (line.startsWith('- ')) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${processInline(line.slice(2))}</li>`)
      continue
    }
    if (line.trim() === '') {
      if (inList) { html.push('</ul>'); inList = false }
      html.push('<div class="weights-md-spacer"></div>')
      continue
    }
    if (inList) { html.push('</ul>'); inList = false }
    html.push(`<p>${processInline(line)}</p>`)
  }

  if (inList) html.push('</ul>')
  if (inTable) html.push('</tbody></table>')
  if (inCodeBlock) html.push('</pre>')
  return html.join('')
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

type MarketShareRegion = 'average' | 'us' | 'asia' | 'europe'

type MarketShareBaseline = {
  price_index: number
  quality_score: number
  features_count: number
  marketing_pct: number
  csr_score: number
  training_score: number
}

// Helper to convert game engine market preferences to WeightsLab field names
function mapMarketPreferences(prefs: { priceWeight: number; qualityWeight: number; featuresWeight: number; promotionWeight: number; csrWeight: number; trainingWeight: number }): MarketShareBaseline {
  return {
    price_index: prefs.priceWeight,
    quality_score: prefs.qualityWeight,
    features_count: prefs.featuresWeight,
    marketing_pct: prefs.promotionWeight,
    csr_score: prefs.csrWeight,
    training_score: prefs.trainingWeight
  }
}

function getMarketShareBaseline(region: MarketShareRegion): MarketShareBaseline {
  const prefs = GAME_CONFIG.marketPreferences

  if (region !== 'average') {
    return mapMarketPreferences(prefs[region])
  }

  // Calculate average across all regions
  const us = prefs.us
  const asia = prefs.asia
  const europe = prefs.europe

  return {
    price_index: (us.priceWeight + asia.priceWeight + europe.priceWeight) / 3,
    quality_score: (us.qualityWeight + asia.qualityWeight + europe.qualityWeight) / 3,
    features_count: (us.featuresWeight + asia.featuresWeight + europe.featuresWeight) / 3,
    marketing_pct: (us.promotionWeight + asia.promotionWeight + europe.promotionWeight) / 3,
    csr_score: (us.csrWeight + asia.csrWeight + europe.csrWeight) / 3,
    training_score: (us.trainingWeight + asia.trainingWeight + europe.trainingWeight) / 3
  }
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

function buildRecommendations(
  baseline: Record<string, number>,
  analysis: AnalysisResult,
  featureFields: string[]
) {
  const baselineSum = Object.values(baseline).reduce((sum, value) => sum + value, 0) || 1
  const mapped = Object.entries(baseline)
    .map(([key, base]) => {
      const idx = featureFields.indexOf(key)
      if (idx == -1) return null
      const modelNormalized = analysis.ols.normalized[idx]
      const scaledToBaseline = Math.abs(modelNormalized) * baselineSum
      return {
        key,
        base,
        modelNormalized,
        scaledToBaseline,
        diff: scaledToBaseline - base
      }
    })
    .filter((item): item is { key: string; base: number; modelNormalized: number; scaledToBaseline: number; diff: number } => !!item)

  return mapped
}


export function WeightsLabPage() {
  const [mode, setMode] = useState<ModeKey>('sharePrice')
  const [dataset, setDataset] = useState<ParsedCsv | null>(null)
  const [targetField, setTargetField] = useState<string>(MODES.sharePrice.targetField)
  const [featureFields, setFeatureFields] = useState<string[]>([...MODES.sharePrice.defaultFeatures])
  const [ridgeLambda, setRidgeLambda] = useState(0.25)
  const [industryFilter, setIndustryFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('Global')
  const [error, setError] = useState<string | null>(null)
  const [datasetMode, setDatasetMode] = useState<ModeKey | 'custom' | null>(null)
  const [showProjectData, setShowProjectData] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)
  const [baselineRegion, setBaselineRegion] = useState<MarketShareRegion>('average')
  const [showFullMethodology, setShowFullMethodology] = useState(false)
  const [fullMethodology, setFullMethodology] = useState('')
  const [loadingMethodology, setLoadingMethodology] = useState(false)
  const [methodologyTab, setMethodologyTab] = useState<'sharePrice' | 'marketShare'>('sharePrice')

  // Session menu state
  const [sessionOpen, setSessionOpen] = useState(false)
  const [userSession, setUserSession] = useState<{ email?: string; role?: string } | null>(null)
  const accountMenuRef = useRef<HTMLButtonElement>(null)

  const availableColumns = dataset?.header ?? []
  const industryOptions = useMemo(() => {
    if (!dataset || !availableColumns.includes('industry')) return []
    const set = new Set<string>()
    for (const row of dataset.rows) {
      if (row.industry) set.add(row.industry)
    }
    return Array.from(set)
  }, [dataset, availableColumns])

  const regionOptions = useMemo(() => {
    if (!dataset || !availableColumns.includes('region')) return []
    const set = new Set<string>()
    for (const row of dataset.rows) {
      if (row.region) set.add(row.region)
    }
    const list = Array.from(set)
    const globalIndex = list.findIndex((value) => value.toLowerCase() == 'global')
    if (globalIndex > 0) {
      const [global] = list.splice(globalIndex, 1)
      list.unshift(global)
    }
    return list
  }, [dataset, availableColumns])


  useEffect(() => {
    if (!MODES[mode].defaultDataset) return
    if (datasetMode == mode) return

    const loadDefault = async () => {
      try {
        const response = await fetch(MODES[mode].defaultDataset)
        if (!response.ok) return
        const text = await response.text()
        const parsed = parseCsv(text)
        setDataset(parsed)
        setTargetField(MODES[mode].targetField)
        setFeatureFields([...MODES[mode].defaultFeatures])
        setIndustryFilter('all')
        setRegionFilter(getDefaultRegion(parsed.rows))
        setDatasetMode(mode)
      } catch {
        // Ignore missing default dataset
      }
    }

    loadDefault()
  }, [datasetMode, mode])

  // Fetch user session on mount - redirect if not logged in
  useEffect(() => {
    const fetchSession = async () => {
      // Try educator first, then admin
      try {
        const educatorRes = await authApi.me('educator') as { success: boolean; email?: string }
        if (educatorRes.success && educatorRes.email) {
          setUserSession({ email: educatorRes.email, role: 'educator' })
          return
        }
      } catch {
        // Ignore
      }
      try {
        const adminRes = await authApi.me('admin')
        if (adminRes.success) {
          setUserSession({ role: 'admin' })
          return
        }
      } catch {
        // Ignore
      }
      // Not logged in as educator or admin - redirect to educator login
      window.location.href = '/educator-login'
    }
    fetchSession()
  }, [])

  // Close session menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setSessionOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    try {
      await authApi.logout(userSession?.role === 'admin' ? 'admin' : 'educator')
    } catch {
      // Ignore
    }
    window.location.href = userSession?.role === 'admin' ? '/modlab' : '/educator-login'
  }

  const analysis = useMemo<AnalysisResult | null>(() => {
    if (!dataset) return null
    if (!featureFields.length || !targetField) return null

    const features: number[][] = []
    const targets: number[] = []

    for (const row of dataset.rows) {
      if (mode === 'sharePrice') {
        if (industryFilter !== 'all' && row.industry !== industryFilter) continue
      } else {
        if (row.region !== regionFilter) continue
      }

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

    if (!features.length) return null

    const { scaled } = standardize(features)

    let warning: string | undefined
    let ols: ModelResult
    try {
      ols = regress(scaled, targets, 0)
    } catch {
      warning = 'OLS failed due to a singular matrix. Using a small ridge penalty for stability.'
      ols = regress(scaled, targets, 0.001)
    }

    const ridgeLambdaSafe = Number.isFinite(ridgeLambda) ? ridgeLambda : 0.25
    const ridge = regress(scaled, targets, ridgeLambdaSafe)

    return { ols, ridge, rowsUsed: features.length, warning }
  }, [dataset, featureFields, industryFilter, regionFilter, ridgeLambda, targetField, mode])

  function applyMode(nextMode: ModeKey) {
    const config = MODES[nextMode]
    setMode(nextMode)
    setTargetField(config.targetField)
    setFeatureFields([...config.defaultFeatures])
    setIndustryFilter('all')
    setRegionFilter('Global')
    setBaselineRegion('average')
    setError(null)
  }

  async function handleFile(file: File) {
    const text = await file.text()
    const parsed = parseCsv(text)
    setDataset(parsed)
    setDatasetMode('custom')
    setRegionFilter(getDefaultRegion(parsed.rows))
    setError(null)

    const defaults = MODES[mode].defaultFeatures.filter((key) => parsed.header.includes(key))
    if (defaults.length) {
      setFeatureFields(defaults)
    } else {
      const fallback = parsed.header.filter((col) => !['company', 'quarter', 'region', 'industry'].includes(col))
      setFeatureFields(fallback.slice(0, 4))
    }

    if (parsed.header.includes(MODES[mode].targetField)) {
      setTargetField(MODES[mode].targetField)
    }
  }

  async function loadMethodology() {
    if (fullMethodology || loadingMethodology) return
    setLoadingMethodology(true)
    try {
      const response = await fetch('/weights-lab/Methodology.md')
      if (!response.ok) throw new Error('Methodology not found')
      const text = await response.text()
      setFullMethodology(text)
    } catch {
      setFullMethodology('Methodology file not available.')
    } finally {
      setLoadingMethodology(false)
    }
  }

  async function loadDefaultDataset() {
    if (!MODES[mode].defaultDataset) {
      setError('No default dataset configured for this mode.')
      return
    }
    try {
      const response = await fetch(MODES[mode].defaultDataset)
      if (!response.ok) throw new Error('Default dataset not found.')
      const text = await response.text()
      const parsed = parseCsv(text)
      setDataset(parsed)
      setTargetField(MODES[mode].targetField)
      setFeatureFields([...MODES[mode].defaultFeatures])
      setIndustryFilter('all')
      setRegionFilter(getDefaultRegion(parsed.rows))
      setDatasetMode(mode)
      setError(null)
    } catch {
      setError('Default dataset not found. Upload your CSV instead.')
    }
  }

  function toggleFeature(feature: string) {
    setFeatureFields((prev) =>
      prev.includes(feature) ? prev.filter((item) => item !== feature) : [...prev, feature]
    )
  }

  function downloadResults() {
    if (!analysis) return
    const payload = {
      mode,
      targetField,
      featureFields,
      industryFilter,
      ridgeLambda,
      rowsUsed: analysis.rowsUsed,
      ols: analysis.ols,
      ridge: analysis.ridge
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'weights_lab_results.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const baselineWeights = mode == 'sharePrice'
    ? getSharePriceBaseline()
    : getMarketShareBaseline(baselineRegion)
  const baselineEntries = Object.entries(baselineWeights)
  const recommendations = useMemo(() => {
    if (!analysis) return []
    return buildRecommendations(baselineWeights, analysis, featureFields)
  }, [analysis, baselineWeights, featureFields])

  const weightRows = useMemo(() => {
    if (!analysis) return []
    return featureFields.map((field, idx) => ({
      field,
      baseline: (baselineWeights as Record<string, number>)[field] ?? null,
      ols: analysis.ols.normalized[idx],
      ridge: analysis.ridge.normalized[idx]
    }))
  }, [analysis, baselineWeights, featureFields])

  return (
    <div className="weights-lab-page">
      <header className="weights-header">
        <button className="weights-back-btn" onClick={() => window.close()} title="Close window">
          ← Back to Dashboard
        </button>
        <div className="weights-header-spacer" />
        {userSession && (
          <button
            ref={accountMenuRef}
            type="button"
            className="weights-session-btn"
            onClick={() => setSessionOpen(!sessionOpen)}
          >
            <span className="weights-session-label">Account</span>
            <span className="weights-session-caret">▾</span>
            {sessionOpen && (
              <div className="weights-session-menu" onClick={(e) => e.stopPropagation()}>
                {userSession.email && (
                  <div className="weights-session-row">
                    <span className="weights-session-email">{userSession.email}</span>
                  </div>
                )}
                <div className="weights-session-row">
                  <button type="button" className="weights-session-action weights-logout" onClick={handleLogout}>
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </button>
        )}
      </header>
      <div className="weights-tabs">
        {Object.values(MODES).map((config) => (
          <button
            key={config.id}
            className={`weights-tab ${mode === config.id ? 'active' : ''}`}
            onClick={() => applyMode(config.id as ModeKey)}
          >
            {config.label}
          </button>
        ))}
      </div>
      <section className="weights-hero">
        <div className="weights-hero-inner">
          <div>
            <span className="weights-chip">Weights Lab</span>
            <h1>Calibrate weights with real-world data.</h1>
            <p>
              Upload a quarterly dataset, run regression + ridge, and compare to your current game baselines.
            </p>
            <div className="weights-actions">
              <button className="weights-btn primary" onClick={loadDefaultDataset}>Load Project Data</button>
              <label className="weights-btn ghost">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </label>
            </div>
          </div>
          <div className="weights-hero-card">
            <h3>Expected CSV</h3>
            <code>{MODES[mode].expectedColumns}</code>
            <div className="weights-hero-metrics">
              <div>
                <span>Target</span>
                <strong>{targetField}</strong>
              </div>
              <div>
                <span>Features</span>
                <strong>{featureFields.join(' + ') || 'Select features'}</strong>
              </div>
            </div>
            <div className="weights-card-actions">
              <button
                className="weights-btn ghost"
                onClick={() => triggerDownload(MODES[mode].templateDownload, `${mode}_template.csv`)}
              >
                Download Template CSV
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="weights-panel">
        <div className="weights-panel-header">
          <div className="weights-panel-title">
            <h2>1. Dataset Controls</h2>
            <button
              className="weights-btn ghost"
              onClick={() => {
                setShowProjectData((prev) => {
                  const next = !prev
                  if (!next) setShowAllRows(false)
                  return next
                })
              }}
              disabled={!dataset}>
              {showProjectData ? 'Hide Project Data' : 'View Project Data'}
            </button>
          </div>
          <p>Choose the target, features, and industry slice before running the model.</p>
        </div>
        <div className="weights-controls">
          <div className="weights-control">
            <label>Target field</label>
            <select
              value={targetField}
              onChange={(event) => setTargetField(event.target.value)}
            >
              {availableColumns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div className="weights-control">
            <label>{mode === 'sharePrice' ? 'Industry filter' : 'Region filter'}</label>
            {mode === 'sharePrice' ? (
              <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)}>
                <option value="all">All industries</option>
                {industryOptions.map((industry) => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            ) : (
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            )}
          </div>
          <div className="weights-control">
            <label>Ridge strength <span className="weights-tooltip" title="Low λ keeps weights close to raw regression. High λ shrinks weights toward zero to reduce noise and overfitting.">?</span></label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ridgeLambda}
              onChange={(event) => setRidgeLambda(Number(event.target.value))}
            />
            <span className="weights-slider-value">λ = {ridgeLambda.toFixed(2)}</span>
          </div>
        </div>

        <div className="weights-feature-grid">
          {availableColumns
            .filter((col) => !['company', 'quarter', 'region', 'industry'].includes(col))
            .map((col) => (
              <label key={col} className={featureFields.includes(col) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={featureFields.includes(col)}
                  onChange={() => toggleFeature(col)}
                />
                {col}
              </label>
            ))}
        </div>

        {error && <div className="weights-error">{error}</div>}
        {showProjectData && dataset && (
          <div className="weights-project-data">
            <h3>Project Data Preview</h3>
            <p>
              {showAllRows
                ? `Showing all ${dataset.rows.length} rows from the loaded dataset.`
                : 'Showing first 12 rows from the loaded dataset.'}
            </p>
            {!showAllRows && dataset.rows.length > 12 && (
              <button className="weights-btn ghost" onClick={() => setShowAllRows(true)}>
                Load Full Dataset
              </button>
            )}
            <div className="weights-table-wrap">
              <table>
                <thead>
                  <tr>
                    {dataset.header.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showAllRows ? dataset.rows : dataset.rows.slice(0, 12)).map((row, idx) => (
                    <tr key={idx}>
                      {dataset.header.map((col) => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="weights-panel">
        <div className="weights-panel-header">
          <h2>2. Model Results</h2>
          <p>OLS delivers interpretable weights. Ridge shows a regularized ML alternative.</p>
        </div>

        {!analysis && (
          <div className="weights-empty">
            Upload a dataset to view results.
          </div>
        )}

        {analysis?.warning && (
          <div className="weights-warning">{analysis.warning}</div>
        )}

        {analysis && (
          <div className="weights-results">
            <div className="weights-result-card">
              <header>
                <h3>OLS Regression</h3>
                <span>R² {analysis.ols.r2.toFixed(2)}</span>
              </header>
              {weightRows.map((row) => (
                <div key={row.field} className="weights-row">
                  <div>
                    <strong>{row.field}</strong>
                    {row.baseline !== null && <span>Baseline {formatPct(row.baseline)}</span>}
                  </div>
                  <div className="weights-bar">
                    <div style={{ width: `${Math.abs(row.ols) * 100}%` }} />
                  </div>
                  <div className="weights-value">{formatPct(row.ols)}</div>
                </div>
              ))}
            </div>

            <div className="weights-result-card">
              <header>
                <h3>Ridge (ML fit)</h3>
                <span>R² {analysis.ridge.r2.toFixed(2)}</span>
              </header>
              {weightRows.map((row) => (
                <div key={row.field} className="weights-row">
                  <div>
                    <strong>{row.field}</strong>
                    {row.baseline !== null && <span>Baseline {formatPct(row.baseline)}</span>}
                  </div>
                  <div className="weights-bar alt">
                    <div style={{ width: `${Math.abs(row.ridge) * 100}%` }} />
                  </div>
                  <div className="weights-value">{formatPct(row.ridge)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && (
          <div className="weights-footer">
            <div>
              <strong>Rows used:</strong> {analysis.rowsUsed}
            </div>
            <button className="weights-btn primary" onClick={downloadResults}>Download Results JSON</button>
          </div>
        )}
      </section>

      <section className="weights-panel">
        <div className="weights-panel-header">
          <div className="weights-panel-title">
            <h2>3. Compare To Game Baseline</h2>
            {mode == 'marketShare' && (
              <div className="weights-baseline-select">
                <label>Baseline region</label>
                <select value={baselineRegion} onChange={(event) => setBaselineRegion(event.target.value as MarketShareRegion)}>
                  <option value="average">Average</option>
                  <option value="us">US</option>
                  <option value="asia">Asia</option>
                  <option value="europe">Europe</option>
                </select>
              </div>
            )}
          </div>
          <p>Baseline weights for comparison.</p>
        </div>
        <div className="weights-baseline">
          {baselineEntries.map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{formatPct(value)}</strong>
              </div>
            ))}
        </div>
        {analysis && recommendations.length > 0 && (
          <div className="weights-recommendations">
            <h3>Recommended Adjustments</h3>
            <div className="weights-recommendations-chart">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={recommendations.map((item) => ({
                    name: item.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    Baseline: +(item.base * 100).toFixed(1),
                    Suggested: +(item.scaledToBaseline * 100).toFixed(1)
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e0e0e0)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Baseline" fill="var(--baseline-color, #8884d8)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Suggested" fill="var(--suggested-color, #82ca9d)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="weights-recommendations-grid">
              {recommendations.map((item) => (
                <div key={item.key} className="weights-recommendation-card">
                  <div className="weights-recommendation-title">{item.key}</div>
                  <div className="weights-recommendation-values">
                    <span>Baseline {formatPct(item.base)}</span>
                    <span>Suggested {formatPct(item.scaledToBaseline)}</span>
                  </div>
                  <div className="weights-recommendation-diff">
                    {item.diff >= 0 ? 'Increase' : 'Decrease'} by {formatPct(Math.abs(item.diff))}
                  </div>
                </div>
              ))}
            </div>
            <p className="weights-recommendations-note">
              Suggested values are OLS weights scaled to the baseline sum ({formatPct(Object.values(baselineWeights).reduce((s, v) => s + v, 0))}). Compare on a like-for-like scale.
            </p>
          </div>
        )}
      </section>

      <section className="weights-panel">
        <div className="weights-panel-header">
          <h2>4. Research Methodology</h2>
          <p>Short audit note for professor review. Full details available in the methodology file.</p>
        </div>
        <div className="weights-methodology">
          <h3>{METHODOLOGY_SNIPPETS[mode].title}</h3>
          <ul>
            {METHODOLOGY_SNIPPETS[mode].points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {showFullMethodology && (
            <div className="weights-methodology-modal">
              <div className="weights-methodology-backdrop" onClick={() => setShowFullMethodology(false)} />
              <div className="weights-methodology-dialog">
                <div className="weights-methodology-dialog-header">
                  <h3>Full Methodology</h3>
                  <button className="weights-modal-close" onClick={() => setShowFullMethodology(false)} aria-label="Close methodology">×</button>
                </div>
                <div className="weights-methodology-tabs">
                  <button
                    className={`weights-methodology-tab ${methodologyTab === 'sharePrice' ? 'active' : ''}`}
                    onClick={() => setMethodologyTab('sharePrice')}
                  >
                    Share Price
                  </button>
                  <button
                    className={`weights-methodology-tab ${methodologyTab === 'marketShare' ? 'active' : ''}`}
                    onClick={() => setMethodologyTab('marketShare')}
                  >
                    Market Share
                  </button>
                </div>
                <div className="weights-methodology-dialog-body">
                  {loadingMethodology ? (
                    <p>Loading methodology...</p>
                  ) : (
                    <div dangerouslySetInnerHTML={{
                      __html: renderMarkdown(
                        (() => {
                          const parts = fullMethodology.split(/^---$/m)
                          if (parts.length < 2) return fullMethodology
                          return methodologyTab === 'sharePrice'
                            ? parts[0].replace(/^# Methodology Notes\s*\n/, '')
                            : parts[1]
                        })()
                      )
                    }} />
                  )}
                </div>
              </div>
            </div>
          )}
          <button
            className="weights-btn ghost"
            onClick={() => {
              if (!showFullMethodology) {
                loadMethodology()
                setMethodologyTab(mode)
              }
              setShowFullMethodology((prev) => !prev)
            }}
          >
            {showFullMethodology ? 'Hide Full Methodology' : 'Show Full Methodology'}
          </button>
        </div>
      </section>
    </div>
  )
}


