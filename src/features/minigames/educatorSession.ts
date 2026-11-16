import { authApi } from '../../api/client'

type CachedEducatorSession = {
  ok: boolean
  email: string
  credits: number | null
  at: number
}

const CACHE_KEY = 'mg_educator_session_cache_v1'
const TTL_MS = 5 * 60 * 1000
let inflight: Promise<CachedEducatorSession> | null = null

function readCache(): CachedEducatorSession | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedEducatorSession
    if (!parsed || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(value: CachedEducatorSession) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}

/** Synchronous cache read — returns null if no valid cached result exists. */
export function getEducatorSessionSync(): CachedEducatorSession | null {
  return readCache()
}

export function clearEducatorSessionCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore storage failures
  }
}

export async function getEducatorSessionCached(force = false): Promise<CachedEducatorSession> {
  if (!force) {
    const cached = readCache()
    if (cached) return cached
  }

  if (!force && inflight) return inflight

  inflight = (async () => {
    try {
      const me = (await authApi.me('educator')) as { email?: string; credits?: unknown } | null
      const next: CachedEducatorSession = {
        ok: true,
        email: String(me?.email || ''),
        credits: typeof me?.credits === 'number' ? Number(me.credits) : null,
        at: Date.now(),
      }
      writeCache(next)
      return next
    } catch {
      const next: CachedEducatorSession = {
        ok: false,
        email: '',
        credits: null,
        at: Date.now(),
      }
      writeCache(next)
      return next
    } finally {
      inflight = null
    }
  })()

  return inflight
}

