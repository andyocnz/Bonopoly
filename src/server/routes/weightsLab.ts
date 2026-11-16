import { Router } from 'express'

const router = Router()

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

const parseCsv = (text: string): ParsedCsv => {
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

const standardize = (features: number[][]) => {
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
  return { scaled, means, stds }
}

const transpose = (matrix: number[][]): number[][] => matrix[0].map((_, col) => matrix.map((row) => row[col]))

const multiply = (a: number[][], b: number[][]): number[][] => {
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

const invert = (matrix: number[][]): number[][] => {
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

const addRidge = (matrix: number[][], lambda: number): number[][] =>
  matrix.map((row, i) => row.map((value, j) => (i === j ? value + lambda : value)))

const regress = (features: number[][], target: number[], ridgeLambda = 0): ModelResult => {
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

const toNumber = (value: string | undefined) => {
  if (!value) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

router.post('/analyze', (req, res) => {
  const { csv, targetField, featureFields, ridgeLambda, industryFilter } = req.body ?? {}

  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'Missing csv text' })
  }

  const parsed = parseCsv(csv)
  if (!parsed.header.length) {
    return res.status(400).json({ error: 'CSV header missing' })
  }

  const target = typeof targetField === 'string' ? targetField : 'price_change'
  const features = Array.isArray(featureFields) ? featureFields : []
  if (!features.length) {
    return res.status(400).json({ error: 'No feature fields provided' })
  }

  const lambda = Number.isFinite(Number(ridgeLambda)) ? Number(ridgeLambda) : 0.25
  const filter = typeof industryFilter === 'string' ? industryFilter : 'all'

  const featureMatrix: number[][] = []
  const targetVector: number[] = []

  for (const row of parsed.rows) {
    if (filter !== 'all' && row.industry !== filter) continue

    const targetValue = toNumber(row[target])
    if (targetValue === null) continue

    const featureRow: number[] = []
    let valid = true
    for (const field of features) {
      const value = toNumber(row[field])
      if (value === null) {
        valid = false
        break
      }
      featureRow.push(value)
    }
    if (!valid) continue

    featureMatrix.push(featureRow)
    targetVector.push(targetValue)
  }

  if (!featureMatrix.length) {
    return res.status(400).json({ error: 'No valid rows after filtering' })
  }

  const { scaled } = standardize(featureMatrix)
  const ols = regress(scaled, targetVector, 0)
  const ridge = regress(scaled, targetVector, lambda)

  return res.json({
    rowsUsed: featureMatrix.length,
    ols,
    ridge
  })
})

export default router
