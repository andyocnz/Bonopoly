export type RegressionResult = {
  coefficients: number[]
  intercept: number
  r2: number
}

export function standardize(features: number[][]): { scaled: number[][]; means: number[]; stds: number[] } {
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

export function regress(features: number[][], target: number[], ridgeLambda = 0): RegressionResult {
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
  return { coefficients, intercept, r2 }
}
