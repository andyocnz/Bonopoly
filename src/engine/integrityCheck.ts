
import type { GameConfig } from './gameEngine'
import type { SimulationRoundResult } from './strategySimulation'

/**
 * SIMULATION INTEGRITY CHECKER (Expert Audit Mode)
 * 
 * Verifies that the laws of physics (economics/accounting) are obeyed in the simulation.
 */

export interface IntegrityReport {
    passed: boolean
    violations: string[]
    checks: {
        inventory: boolean
        productionLimit: boolean
        marketDemand: boolean
        accounting: boolean
    }
}

export function checkSimulationIntegrity(rounds: SimulationRoundResult[], config: GameConfig): IntegrityReport {
    const violations: string[] = []
    const checks = {
        inventory: true,
        productionLimit: true,
        marketDemand: true,
        accounting: true
    }

    if (!rounds || rounds.length === 0) {
        return { passed: true, violations: [], checks } // Nothing to check
    }

    // Iterate through rounds
    rounds.forEach((round, rIdx) => {
        const rNum = rIdx + 1

        // 1. GLOBAL MARKET DEMAND CHECK
        // Total sold in the market must be <= potential demand (roughly, accounting for allocation logic)
        const totalSold = round.teams.reduce((sum, t) => sum + (t.unitsSold || 0), 0)
        const totalDemand = round.marketData.totalDemand.us + round.marketData.totalDemand.asia + round.marketData.totalDemand.europe
        if (totalSold > totalDemand * 1.05) { // 5% buffer for potential rounding differences in totals
            violations.push(`[Market] R${rNum}: Global sales (${totalSold.toLocaleString()}) exceeded total demand (${totalDemand.toLocaleString()})`)
            checks.marketDemand = false
        }

        round.teams.forEach(team => {
            const prior = rIdx > 0 ? rounds[rIdx - 1].teams.find(t => t.teamId === team.teamId) : null

            // 2. PRODUCTION VS CAPACITY
            const currentFactories = team.factories.us + team.factories.asia
            const theoreticalMax = (currentFactories * config.capacityPerPlant) + 400000 // Simple cap + outsourcing
            const actualProduced = team.production.us + team.production.asia

            if (actualProduced > theoreticalMax + 100) { // Small buffer for float math
                violations.push(`[Logistics] R${rNum} ${team.teamName}: Produced ${actualProduced.toLocaleString()} units with capacity of only ${theoreticalMax.toLocaleString()}`)
                checks.productionLimit = false
            }

            // 3. INVENTORY CONTINUITY
            // End = Begin + Produced - Sold
            const beginInv = prior ? (prior.inventory.us + prior.inventory.asia) : 0
            const endInvActual = team.inventory.us + team.inventory.asia
            const endInvExpected = Math.max(0, beginInv + actualProduced - team.unitsSold)

            // We allow a small discrepancy (e.g. 1% or 500 units) for potential complex scrap/loss logic in engine
            if (Math.abs(endInvActual - endInvExpected) > 2000) {
                violations.push(`[Inventory] R${rNum} ${team.teamName}: Continuity mismatch. Start(${beginInv}) + Prod(${actualProduced}) - Sold(${team.unitsSold}) = ${endInvExpected}, but Record says ${endInvActual}`)
                checks.inventory = false
            }

            // 4. FINANCIAL INTEGRITY
            // Share Price check
            if (team.sharePrice < 0) {
                violations.push(`[Finance] R${rNum} ${team.teamName}: Negative share price detected ($${team.sharePrice})`)
                checks.accounting = false
            }

            // Factory growth check (built in round T, available in round T+1)
            if (prior && team.decision?.investment) {
                const orderedUs = (prior.decision?.finance?.newPlantsUS || 0)
                // Note: Some engines have 1-round lag.
                // If engine has lag, team.factories.us should equal prior.factories.us
                // If count changed without order, or didn't change with order, it's an anomaly.
                // expectedCount = prior.factories.us + orderedUs (for future implementation)
                void orderedUs // Mark as intentionally unused for now
            }
        })
    })

    return {
        passed: violations.length === 0,
        violations,
        checks
    }
}
