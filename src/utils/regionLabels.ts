export type RegionKey = 'us' | 'asia' | 'europe'

export type RegionLabels = Record<RegionKey, string>

export const DEFAULT_REGION_LABELS: RegionLabels = {
  us: 'Americas',
  asia: 'Asia',
  europe: 'Europe',
}

export function getRegionLabels(game?: { regionLabels?: Partial<RegionLabels> | null }): RegionLabels {
  const labels = game?.regionLabels ?? {}
  const isLegacyDefaults = labels.us === 'US' && labels.asia === 'Asia' && labels.europe === 'Europe'
  const normalized = isLegacyDefaults ? {} : labels
  return {
    us: normalized.us ?? DEFAULT_REGION_LABELS.us,
    asia: normalized.asia ?? DEFAULT_REGION_LABELS.asia,
    europe: normalized.europe ?? DEFAULT_REGION_LABELS.europe,
  }
}
