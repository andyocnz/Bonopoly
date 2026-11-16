import { GAME_CONFIG } from '../engine/gameEngine'

export interface LogisticsAllocation {
  us: { local: number; fromAsia: number }
  asia: { local: number; fromUS: number }
  europe: { fromUS: number; fromAsia: number }
}

export type LogisticsTariffs = {
  usToUs: number
  usToAsia: number
  usToEurope: number
  asiaToUs: number
  asiaToAsia: number
  asiaToEurope: number
}

export interface LogisticsInput {
  usSupply: number
  asiaSupply: number
  demands: {
    us: number
    asia: number
    europe: number
  }
  usPriority: ('us' | 'asia' | 'europe')[]
  asiaPriority: ('us' | 'asia' | 'europe')[]
}

export function applyLogisticsTariffModifiers(
  baseTariffs: LogisticsTariffs,
  modifiers: Partial<LogisticsTariffs> = {}
): LogisticsTariffs {
  const applyModifier = (baseValue: number, modifier?: number) => {
    if (typeof modifier !== 'number' || !Number.isFinite(modifier)) return baseValue
    return baseValue * (1 + modifier)
  }
  return {
    usToUs: applyModifier(baseTariffs.usToUs, modifiers.usToUs),
    usToAsia: applyModifier(baseTariffs.usToAsia, modifiers.usToAsia),
    usToEurope: applyModifier(baseTariffs.usToEurope, modifiers.usToEurope),
    asiaToUs: applyModifier(baseTariffs.asiaToUs, modifiers.asiaToUs),
    asiaToAsia: applyModifier(baseTariffs.asiaToAsia, modifiers.asiaToAsia),
    asiaToEurope: applyModifier(baseTariffs.asiaToEurope, modifiers.asiaToEurope),
  }
}

/**
 * Calculate logistics allocation using the game's routing algorithm.
 * This is the SINGLE SOURCE OF TRUTH for how products are allocated to regions.
 *
 * Algorithm (HYBRID: LOCAL-FIRST when local priority first, PRIORITY-FIRST otherwise):
 * - IF user sets their own region FIRST in priority → LOCAL-FIRST (serve local, then ship excess)
 * - IF user sets another region FIRST in priority → PRIORITY-FIRST (ship to high-profit markets first)
 *
 * Examples:
 * - usPriority=['us', 'europe', 'asia'] → US serves US demand first, then ships excess
 * - usPriority=['asia', 'europe', 'us'] → US ships to Asia first (for higher profits), US may have shortages
 */
export function calculateLogisticsAllocation(input: LogisticsInput): LogisticsAllocation {
  const { usSupply, asiaSupply, demands, usPriority, asiaPriority } = input

  const allocations: LogisticsAllocation = {
    us: { local: 0, fromAsia: 0 },
    asia: { local: 0, fromUS: 0 },
    europe: { fromUS: 0, fromAsia: 0 },
  }

  // Check if user wants LOCAL-FIRST behavior
  const usWantsLocalFirst = usPriority[0] === 'us'
  const asiaWantsLocalFirst = asiaPriority[0] === 'asia'

  let remainingUS = usSupply
  let remainingAsia = asiaSupply

  // Helper to get total served to a region (from all sources)
  const getServed = (region: 'us' | 'asia' | 'europe'): number => {
    if (region === 'us') return allocations.us.local + allocations.us.fromAsia
    if (region === 'asia') return allocations.asia.local + allocations.asia.fromUS
    return allocations.europe.fromUS + allocations.europe.fromAsia
  }

  // Helper to allocate from US supply to a region
  const allocateFromUS = (region: 'us' | 'asia' | 'europe', amount: number) => {
    if (region === 'us') allocations.us.local += amount
    else if (region === 'asia') allocations.asia.fromUS += amount
    else allocations.europe.fromUS += amount
    remainingUS -= amount
  }

  // Helper to allocate from Asia supply to a region
  const allocateFromAsia = (region: 'us' | 'asia' | 'europe', amount: number) => {
    if (region === 'asia') allocations.asia.local += amount
    else if (region === 'us') allocations.us.fromAsia += amount
    else allocations.europe.fromAsia += amount
    remainingAsia -= amount
  }

  // STEP 1: Handle LOCAL-FIRST constraint for US (if US is first priority)
  if (usWantsLocalFirst && demands.us > 0) {
    const localAllocation = Math.min(remainingUS, demands.us)
    allocateFromUS('us', localAllocation)
  }

  // STEP 2: Handle LOCAL-FIRST constraint for Asia (if Asia is first priority)
  if (asiaWantsLocalFirst && demands.asia > 0) {
    const localAllocation = Math.min(remainingAsia, demands.asia)
    allocateFromAsia('asia', localAllocation)
  }

  // STEP 3: Ship from US following priority order
  for (const region of usPriority) {
    if (remainingUS <= 0) break
    const need = Math.max(0, demands[region] - getServed(region))
    if (need <= 0) continue
    const ship = Math.min(remainingUS, need)
    if (ship > 0) allocateFromUS(region, ship)
  }

  // STEP 4: Ship from Asia following priority order
  for (const region of asiaPriority) {
    if (remainingAsia <= 0) break
    const need = Math.max(0, demands[region] - getServed(region))
    if (need <= 0) continue
    const ship = Math.min(remainingAsia, need)
    if (ship > 0) allocateFromAsia(region, ship)
  }

  return allocations
}

/**
 * Calculate per-unit logistics cost for a specific region based on allocation
 */
export function calculatePerUnitLogisticsCost(
  region: 'us' | 'asia' | 'europe',
  allocation: LogisticsAllocation,
  tariffs = GAME_CONFIG.logisticsTariff
): number {
  if (region === 'us') {
    const total = allocation.us.local + allocation.us.fromAsia
    if (total === 0) return 0
    const fromUSCost = allocation.us.local * 0  // Local = $0
    const fromAsiaCost = allocation.us.fromAsia * tariffs.asiaToUs
    return (fromUSCost + fromAsiaCost) / total
  }

  if (region === 'asia') {
    const total = allocation.asia.local + allocation.asia.fromUS
    if (total === 0) return 0
    const fromAsiaCost = allocation.asia.local * 0  // Local = $0
    const fromUSCost = allocation.asia.fromUS * tariffs.usToAsia
    return (fromAsiaCost + fromUSCost) / total
  }

  // Europe
  const total = allocation.europe.fromUS + allocation.europe.fromAsia
  if (total === 0) return 0
  const fromUSCost = allocation.europe.fromUS * tariffs.usToEurope
  const fromAsiaCost = allocation.europe.fromAsia * tariffs.asiaToEurope
  return (fromUSCost + fromAsiaCost) / total
}

/**
 * Calculate total logistics cost from allocation
 * This is used by the game engine for cost calculations
 */
export function calculateTotalLogisticsCost(
  allocation: LogisticsAllocation,
  tariffs = GAME_CONFIG.logisticsTariff
): number {
  // Local shipments are free (usToUs and asiaToAsia)
  const usToAsiaCost = allocation.asia.fromUS * tariffs.usToAsia
  const usToEuropeCost = allocation.europe.fromUS * tariffs.usToEurope
  const asiaToUsCost = allocation.us.fromAsia * tariffs.asiaToUs
  const asiaToEuropeCost = allocation.europe.fromAsia * tariffs.asiaToEurope

  return usToAsiaCost + usToEuropeCost + asiaToUsCost + asiaToEuropeCost
}

/**
 * Get human-readable origin breakdown for a region
 */
export function getOriginBreakdown(
  region: 'us' | 'asia' | 'europe',
  allocation: LogisticsAllocation
): string {
  if (region === 'us') {
    const total = allocation.us.local + allocation.us.fromAsia
    if (total === 0) return 'No supply'
    const usPercent = Math.round((allocation.us.local / total) * 100)
    const asiaPercent = Math.round((allocation.us.fromAsia / total) * 100)
    return `${usPercent}% US, ${asiaPercent}% Asia`
  }

  if (region === 'asia') {
    const total = allocation.asia.local + allocation.asia.fromUS
    if (total === 0) return 'No supply'
    const asiaPercent = Math.round((allocation.asia.local / total) * 100)
    const usPercent = Math.round((allocation.asia.fromUS / total) * 100)
    return `${asiaPercent}% Asia, ${usPercent}% US`
  }

  // Europe
  const total = allocation.europe.fromUS + allocation.europe.fromAsia
  if (total === 0) return 'No supply'
  const usPercent = Math.round((allocation.europe.fromUS / total) * 100)
  const asiaPercent = Math.round((allocation.europe.fromAsia / total) * 100)
  return `${usPercent}% US, ${asiaPercent}% Asia`
}
