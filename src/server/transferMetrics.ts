import type { RequestHandler } from 'express'

type EndpointMetrics = {
  method: string
  endpoint: string
  requests: number
  bytesOut: number
  bytesIn: number
  avgBytesOut: number
  avgMs: number
  p95Ms: number
  lastStatus: number
  lastSeenAt: string
}

type MetricsStoreRow = {
  method: string
  endpoint: string
  requests: number
  bytesOut: number
  bytesIn: number
  totalMs: number
  durations: number[]
  lastStatus: number
  lastSeenAt: number
}

const startedAt = Date.now()
const endpointStore = new Map<string, MetricsStoreRow>()
const MAX_DURATION_SAMPLES = 200
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const LONG_HEX_RE = /[0-9a-f]{16,}/gi
const NUMERIC_SEGMENT_RE = /\/\d+(?=\/|$)/g

function normalizePath(path: string): string {
  return path
    .replace(UUID_RE, ':id')
    .replace(LONG_HEX_RE, ':id')
    .replace(NUMERIC_SEGMENT_RE, '/:num')
}

function isTeamResultsEndpoint(endpoint: string): boolean {
  return endpoint === '/:id/results'
    || endpoint === '/teams/:id/results'
    || endpoint === '/api/teams/:id/results'
}

function withModeTag(endpoint: string, query: Record<string, unknown>): string {
  if (!isTeamResultsEndpoint(endpoint)) {
    return endpoint
  }

  const rawMode = typeof query.mode === 'string' ? query.mode.toLowerCase() : ''
  const mode = rawMode === 'metadata' || rawMode === 'summary' || rawMode === 'full'
    ? rawMode
    : 'full'
  return `${endpoint} [mode=${mode}]`
}

function normalizeClientPage(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40)
  return normalized || 'unknown'
}

function withClientPageTag(endpoint: string, clientPageHeader: unknown): string {
  const baseEndpoint = endpoint.replace(/\s+\[mode=[^\]]+\]/g, '')
  if (!isTeamResultsEndpoint(baseEndpoint)) {
    return endpoint
  }
  const raw = typeof clientPageHeader === 'string' ? clientPageHeader : ''
  const page = raw ? normalizeClientPage(raw) : 'unknown'
  return `${endpoint} [page=${page}]`
}

function bytesFromChunk(chunk: unknown, encoding?: BufferEncoding): number {
  if (chunk === undefined || chunk === null) return 0
  if (Buffer.isBuffer(chunk)) return chunk.length
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, encoding)
  try {
    return Buffer.byteLength(String(chunk))
  } catch {
    return 0
  }
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
  return sorted[idx] ?? 0
}

function recordRequest(params: {
  method: string
  endpoint: string
  durationMs: number
  status: number
  bytesOut: number
  bytesIn: number
}) {
  const key = `${params.method} ${params.endpoint}`
  const current = endpointStore.get(key)
  if (!current) {
    endpointStore.set(key, {
      method: params.method,
      endpoint: params.endpoint,
      requests: 1,
      bytesOut: params.bytesOut,
      bytesIn: params.bytesIn,
      totalMs: params.durationMs,
      durations: [params.durationMs],
      lastStatus: params.status,
      lastSeenAt: Date.now(),
    })
    return
  }

  current.requests += 1
  current.bytesOut += params.bytesOut
  current.bytesIn += params.bytesIn
  current.totalMs += params.durationMs
  current.lastStatus = params.status
  current.lastSeenAt = Date.now()
  current.durations.push(params.durationMs)
  if (current.durations.length > MAX_DURATION_SAMPLES) {
    current.durations.shift()
  }
}

export const transferMetricsMiddleware: RequestHandler = (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next()
  }

  const start = Date.now()
  const requestBytes = Number.parseInt(String(req.headers['content-length'] || '0'), 10) || 0
  let responseBytes = 0

  const originalWrite = res.write.bind(res)
  const originalEnd = res.end.bind(res)
  type WriteParams = Parameters<typeof originalWrite>
  type EndParams = Parameters<typeof originalEnd>
  type Callback = (...args: unknown[]) => void

  const patchedWrite: typeof res.write = ((chunk: unknown, encoding?: BufferEncoding, cb?: Callback) => {
    responseBytes += bytesFromChunk(chunk, encoding)
    return originalWrite(
      chunk as WriteParams[0],
      encoding as WriteParams[1],
      cb as WriteParams[2]
    )
  }) as typeof res.write

  const patchedEnd: typeof res.end = ((chunk?: unknown, encoding?: BufferEncoding, cb?: Callback) => {
    responseBytes += bytesFromChunk(chunk, encoding)
    return originalEnd(
      chunk as EndParams[0],
      encoding as EndParams[1],
      cb as EndParams[2]
    )
  }) as typeof res.end
  res.write = patchedWrite
  res.end = patchedEnd

  res.on('finish', () => {
    const durationMs = Date.now() - start
    const normalizedEndpoint = normalizePath(req.path)
    const endpointWithMode = withModeTag(normalizedEndpoint, req.query as Record<string, unknown>)
    const endpointWithModeAndPage = withClientPageTag(endpointWithMode, req.header('x-client-page'))
    const bytesOut = responseBytes > 0
      ? responseBytes
      : Number.parseInt(String(res.getHeader('content-length') || '0'), 10) || 0

    recordRequest({
      method: req.method.toUpperCase(),
      endpoint: endpointWithModeAndPage,
      durationMs,
      status: res.statusCode,
      bytesOut,
      bytesIn: requestBytes,
    })
  })

  next()
}

export function getTransferSummary() {
  const rows: EndpointMetrics[] = Array.from(endpointStore.values())
    .map((row) => ({
      method: row.method,
      endpoint: row.endpoint,
      requests: row.requests,
      bytesOut: row.bytesOut,
      bytesIn: row.bytesIn,
      avgBytesOut: row.requests > 0 ? row.bytesOut / row.requests : 0,
      avgMs: row.requests > 0 ? row.totalMs / row.requests : 0,
      p95Ms: percentile95(row.durations),
      lastStatus: row.lastStatus,
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    }))
    .sort((a, b) => b.bytesOut - a.bytesOut)

  const totals = rows.reduce(
    (acc, row) => {
      acc.requests += row.requests
      acc.bytesOut += row.bytesOut
      acc.bytesIn += row.bytesIn
      return acc
    },
    { requests: 0, bytesOut: 0, bytesIn: 0 }
  )

  return {
    generatedAt: new Date().toISOString(),
    since: new Date(startedAt).toISOString(),
    totals,
    topEndpoints: rows.slice(0, 25),
    endpointCount: rows.length,
  }
}
