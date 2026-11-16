type UnknownRecord = Record<string, unknown>

type WorkerRequest = {
  requestId: string
  source: string
  context: UnknownRecord
}

type WorkerResponse =
  | { requestId: string; source: 'runner'; ok: true; modifiers: UnknownRecord }
  | { requestId: string; source: 'runner'; ok: false; error: string }

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

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const target = value as Record<string, unknown>
  Object.freeze(target)
  Object.keys(target).forEach((key) => {
    const child = target[key]
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  })
  return value
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return Math.min(max, Math.max(min, value))
}

function sanitizeModifiers(input: unknown): UnknownRecord {
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

  if (out.regionalFocus !== 'us' && out.regionalFocus !== 'asia' && out.regionalFocus !== 'europe') {
    delete out.regionalFocus
  }

  return out
}

function runSource(source: string, context: UnknownRecord): UnknownRecord {
  const sanitizedSource = source
    .replace(/\bexport\s+default\s+/g, '')
    .replace(/\bexport\s+/g, '')

  const moduleObj = { exports: {} as UnknownRecord }
  const exportsObj = moduleObj.exports

  const executor = new Function(
    'context',
    'module',
    'exports',
    `
      "use strict";
      const window = undefined;
      const document = undefined;
      const fetch = undefined;
      const XMLHttpRequest = undefined;
      const WebSocket = undefined;
      const self = undefined;
      const globalThis = undefined;
      const postMessage = undefined;
      const importScripts = undefined;
      const setTimeout = undefined;
      const setInterval = undefined;
      ${sanitizedSource}
      const candidate =
        (typeof execute === 'function' && execute) ||
        (module && module.exports && typeof module.exports.execute === 'function' && module.exports.execute) ||
        (exports && typeof exports.execute === 'function' && exports.execute);
      if (typeof candidate !== 'function') {
        throw new Error('Missing execute(context) function');
      }
      return candidate(context);
    `
  ) as (context: UnknownRecord, module: { exports: UnknownRecord }, exports: UnknownRecord) => unknown

  const frozenContext = deepFreeze(structuredClone(context))
  const result = executor(frozenContext, moduleObj, exportsObj)
  return sanitizeModifiers(result)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const requestId = event.data.requestId
  try {
    const result = runSource(event.data.source, event.data.context)
    const response: WorkerResponse = { requestId, source: 'runner', ok: true, modifiers: result }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      requestId,
      source: 'runner',
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown strategy execution error',
    }
    self.postMessage(response)
  }
}
