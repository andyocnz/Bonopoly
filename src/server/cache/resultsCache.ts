import { createHash } from 'crypto'

type ResultsCacheEntry = {
  data: unknown
  etag: string
  timestamp: number
}

const resultsCache = new Map<string, ResultsCacheEntry>()
const resultsVersionByGame = new Map<string, number>()
const CACHE_TTL_MS = 180_000

export function buildResultsCacheKey(gameId: string, mode: string): string {
  return `${gameId}:${mode}`
}

export function getResultsVersion(gameId: string): number {
  return resultsVersionByGame.get(gameId) ?? 0
}

export function getCachedResults(key: string): ResultsCacheEntry | null {
  const cached = resultsCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    resultsCache.delete(key)
    return null
  }
  return cached
}

export function setCachedResults(key: string, data: unknown): ResultsCacheEntry {
  const payload = JSON.stringify(data)
  const digest = createHash('sha1').update(payload).digest('base64')
  const etag = `W/"${digest}"`
  const entry: ResultsCacheEntry = {
    data,
    etag,
    timestamp: Date.now(),
  }
  resultsCache.set(key, entry)
  return entry
}

export function invalidateResultsCache(gameId: string): void {
  const prefix = `${gameId}:`
  for (const key of resultsCache.keys()) {
    if (key.startsWith(prefix)) {
      resultsCache.delete(key)
    }
  }
  const currentVersion = getResultsVersion(gameId)
  resultsVersionByGame.set(gameId, currentVersion + 1)
}
