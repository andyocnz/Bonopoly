
/**
 * Expert Audit Agent - Headless Simulation Runner
 * 
 * This script allows me (the AI) to run a private simulation batch,
 * audit the results for economic integrity, and report back.
 */

import { runBatchSimulation, type BatchSimulationConfig } from '../src/engine/strategySimulation'
import { checkSimulationIntegrity } from '../src/engine/integrityCheck'
import { GAME_CONFIG } from '../src/engine/gameEngine'
import * as fs from 'fs'

async function conductExpertAudit() {
    console.log('🧐 Initiating Expert Audit of Game Engine Logic...')

    const config: BatchSimulationConfig = {
        teamCount: 4,
        strategies: ['predatory-pricing', 'tit-for-tat', 'premium', 'capacity-leader'],
        rounds: 20,
        scenarioId: 1,
        gamesCount: 5, // Small batch for audit
        experimentName: 'audit_validation',
        silent: true
    }

    try {
        const results = await runBatchSimulation(config, () => { })

        // Deeper integrity check on EVERY round of the LAST game
        const lastGame = results.lastGameTrace
        if (!lastGame) throw new Error('Engine failed to provide trace.')

        const integrityReport = checkSimulationIntegrity(lastGame.rounds, GAME_CONFIG)

        // Economic Logic Validation
        const econValidation = {
            avgPriceConvergence: results.aggregatedResults.priceConvergence,
            strategyPerformance: results.aggregatedResults.teamStats,
            violations: integrityReport.violations
        }

        // Save for AI to analyze in the next step
        fs.writeFileSync('expert_audit_log.json', JSON.stringify({
            config,
            integrity: integrityReport,
            econValidation,
            gameTrace: lastGame.rounds.map(r => ({
                round: r.round,
                teams: r.teams.map(t => ({
                    name: t.teamName,
                    sp: t.sharePrice,
                    sold: t.unitsSold,
                    prod: t.production.us + t.production.asia,
                    inv: t.inventory.us + t.inventory.asia
                }))
            }))
        }, null, 2))

        console.log('✅ Expert Audit Complete.')
        console.log(`Integrity Status: ${integrityReport.passed ? 'PERFECT' : 'ANOMALIES FOUND'}`)
        if (!integrityReport.passed) {
            console.log('Violations found:', integrityReport.violations.length)
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Audit Crashed:', message)
    }
}

conductExpertAudit()
