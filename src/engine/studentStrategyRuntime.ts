import type { DecisionModifiers, StrategyContext } from './strategyEngine'

type WorkerRequest = {
  requestId: string
  source: string
  context: StrategyContext
}

type WorkerResponse =
  | { requestId: string; source: 'runner'; ok: true; modifiers: DecisionModifiers }
  | { requestId: string; source: 'runner'; ok: false; error: string }

export type StudentStrategyRunResult = {
  ok: boolean
  modifiers: DecisionModifiers
  timedOut: boolean
  error?: string
}

type UnknownRecord = Record<string, unknown>
type WorkerResponseEnvelope = {
  source?: unknown
  requestId?: unknown
}

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'priceMultiplier',
  'absolutePrices',
  'productionMultiplier',
  'rdInvestmentMultiplier',
  'forceInvestment',
  'blockInvestment',
  'regionalFocus',
  'cooperativeMode',
  'aggressiveMode',
])

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return Math.min(max, Math.max(min, value))
}

function sanitizeModifiers(input: unknown): DecisionModifiers {
  if (!input || typeof input !== 'object') return {}
  const raw = input as UnknownRecord
  const out: UnknownRecord = {}

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) continue
    out[key] = raw[key]
  }

  if (out.priceMultiplier && typeof out.priceMultiplier === 'object') {
    const source = out.priceMultiplier as UnknownRecord
    out.priceMultiplier = {
      us: clamp(source.us, 0.5, 2.0),
      asia: clamp(source.asia, 0.5, 2.0),
      europe: clamp(source.europe, 0.5, 2.0),
    }
  }

  if (out.absolutePrices && typeof out.absolutePrices === 'object') {
    const source = out.absolutePrices as UnknownRecord
    out.absolutePrices = {
      us: clamp(source.us, 50, 200000),
      asia: clamp(source.asia, 50, 200000),
      europe: clamp(source.europe, 50, 200000),
    }
  }

  if (out.productionMultiplier && typeof out.productionMultiplier === 'number') {
    out.productionMultiplier = clamp(out.productionMultiplier, 0.1, 3.0)
  } else if (out.productionMultiplier && typeof out.productionMultiplier === 'object') {
    const source = out.productionMultiplier as UnknownRecord
    out.productionMultiplier = {
      us: clamp(source.us, 0.1, 3.0),
      asia: clamp(source.asia, 0.1, 3.0),
    }
  }

  if (typeof out.rdInvestmentMultiplier !== 'undefined') {
    out.rdInvestmentMultiplier = clamp(out.rdInvestmentMultiplier, 0, 5)
  }

  if (out.forceInvestment && typeof out.forceInvestment === 'object') {
    const source = out.forceInvestment as UnknownRecord
    out.forceInvestment = {
      us: clamp(source.us, 0, 3),
      asia: clamp(source.asia, 0, 3),
    }
  }

  if (typeof out.blockInvestment !== 'boolean') delete out.blockInvestment
  if (typeof out.cooperativeMode !== 'boolean') delete out.cooperativeMode
  if (typeof out.aggressiveMode !== 'boolean') delete out.aggressiveMode
  if (out.regionalFocus !== 'us' && out.regionalFocus !== 'asia' && out.regionalFocus !== 'europe') delete out.regionalFocus

  return out as DecisionModifiers
}

function makeRequestId(): string {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID()
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function runStudentStrategyInWorkerDetailed(
  source: string,
  context: StrategyContext,
  timeoutMs = 200
): Promise<StudentStrategyRunResult> {
  return new Promise<StudentStrategyRunResult>((resolve) => {
    const requestId = makeRequestId()
    const worker = new Worker(new URL('./studentStrategy.worker.ts', import.meta.url), { type: 'module' })
    let settled = false

    const finish = (value: StudentStrategyRunResult) => {
      if (settled) return
      settled = true
      worker.terminate()
      resolve(value)
    }

    const timer = window.setTimeout(() => {
      finish({ ok: false, modifiers: {}, timedOut: true, error: `Execution timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data as WorkerResponse | undefined
      const envelope = event.data as WorkerResponseEnvelope | undefined

      if (!data || typeof data !== 'object') {
        return
      }
      if (envelope?.source !== 'runner') {
        return
      }
      if (envelope?.requestId !== requestId) {
        return
      }

      window.clearTimeout(timer)
      if (!data.ok) {
        finish({ ok: false, modifiers: {}, timedOut: false, error: data.error || 'Worker execution failed' })
        return
      }

      finish({ ok: true, modifiers: sanitizeModifiers(data.modifiers || {}), timedOut: false })
    }

    worker.onerror = () => {
      window.clearTimeout(timer)
      finish({ ok: false, modifiers: {}, timedOut: false, error: 'Worker runtime error' })
    }

    const payload: WorkerRequest = { requestId, source, context: structuredClone(context) }
    worker.postMessage(payload)
  })
}

export async function runStudentStrategyInWorker(
  source: string,
  context: StrategyContext,
  timeoutMs = 200
): Promise<DecisionModifiers> {
  const result = await runStudentStrategyInWorkerDetailed(source, context, timeoutMs)
  return result.modifiers
}
