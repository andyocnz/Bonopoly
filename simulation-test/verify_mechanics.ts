
import {
    calculateRound,
    createInitialGameState,
    getGameConfigForIndustry,
    type TeamGameState,
    type TeamDecisions,
    type TeamResults
} from '../src/engine/gameEngine'

// Helper to create empty decisions
function createEmptyDecisions(): TeamDecisions {
    return {
        production: {
            usUnits: 0, asiaUnits: 0, outsourceUS: 0, outsourceAsia: 0, overtime: 0,
            supplierUS: 2, supplierAsia: 2,
            productionLines: {}, outsource: { techLevel: 1, supplierId: 2, units: 0 },
            demandForecast: { us: 0, asia: 0, europe: 0 },
            techShareForecast: { us: {}, asia: {}, europe: {} } as TeamDecisions['production']['techShareForecast']
        },
        marketing: {
            us: { price: 0, features: 0, promotionPct: 0 },
            asia: { price: 0, features: 0, promotionPct: 0 },
            europe: { price: 0, features: 0, promotionPct: 0 }
        },
        hr: {
            us: { employees: 0, wage: 0, training: 0 },
            asia: { employees: 0, wage: 0, training: 0 }
        },
        rnd: { featureInvestment: 0, researchStaff: 0 },
        investment: { newPlantsUS: 0, newPlantsAsia: 0 },
        logistics: { usPriority: ['us', 'europe', 'asia'], asiaPriority: ['asia', 'europe', 'us'] },
        finance: { borrowing: 0, repayment: 0, shareIssue: 0, shareBuyback: 0, dividend: 0, transferPricing: { us: 1, asia: 1, europe: 1 } }
    }
}

function runVerification() {
    console.log('🧪 Starting Game Mechanics Verification...')
    const config = getGameConfigForIndustry('Oil & Energy')

    // Setup Teams
    const teams = [
        { id: 1, name: 'Control (Baseline)', strategy: 'baseline' },
        { id: 2, name: 'High Price (Elasticity Check)', strategy: 'high_price' },
        { id: 3, name: 'Low Price (Elasticity Check)', strategy: 'low_price' },
        { id: 4, name: 'Investor (Lag Check)', strategy: 'invest' },
        { id: 5, name: 'Innovator (R&D Check)', strategy: 'rnd' },
    ]

    // Initialize States
    const gameStates = new Map<number, TeamGameState>()
    teams.forEach(t => gameStates.set(t.id, createInitialGameState(config)))

    console.log('\n--- 🏁 ROUND 1 SIMULATION ---')

    // Create Round 1 Decisions
    const r1Decisions = teams.map(team => {
        const d = createEmptyDecisions()

        // Base Production (to ensure sales)
        d.production.usUnits = config.initialFactories.us * config.capacityPerPlant
        d.hr.us.employees = 50 // Staff for R&D

        // Base Marketing
        const basePrice = config.priceDemand.baselinePriceByRegion.us
        d.marketing.us.price = basePrice
        d.marketing.asia.price = config.priceDemand.baselinePriceByRegion.asia
        d.marketing.europe.price = config.priceDemand.baselinePriceByRegion.europe

        // Strategy Checks
        if (team.strategy === 'high_price') {
            d.marketing.us.price = basePrice * 1.2 // 20% Higher
        } else if (team.strategy === 'low_price') {
            d.marketing.us.price = basePrice * 0.8 // 20% Lower
        } else if (team.strategy === 'invest') {
            d.finance.borrowing = 50_000_000 // Borrow to pay for plant
            d.investment.newPlantsUS = 1
        } else if (team.strategy === 'rnd') {
            d.rnd.researchStaff = 100 // Hire 100 staff
            d.hr.us.training = 50000 // Training
        }

        return { id: team.id, decisions: d }
    })

    // Run Round 1
    // Note: calculateRound returns RoundResults object
    // type RoundResults = { teams: TeamResults[], ... }
    // type TeamResults = { gameState: TeamGameState, ... }
    // We need to map this back to TeamState[] format for the function which expects an array of {id, decisions} or similar?
    // Actually calculateRound takes `teams: TeamState[]` where TeamState is { id, name, decisions }
    // And `previousGameStates` map.

    const r1InputTeams = r1Decisions.map((d, i) => ({
        id: d.id,
        name: teams[i].name,
        decisions: d.decisions
    }))

    const r1Results = calculateRound(r1InputTeams, 1, gameStates, [0], 1, config)

    // --- VERIFY ROUND 1 ---

    // 1. Price Elasticity Check
    console.log('\n📊 Price Elasticity Check (Round 1):')
    type TeamResultWithAudit = TeamResults & {
        decisions: TeamDecisions
        audit: { desiredUnits: { us: number } }
    }
    const getTeamResult = (id: number) => r1Results.teams.find(t => t.teamId === id)! as TeamResultWithAudit

    const t1 = getTeamResult(1) // Control
    const t2 = getTeamResult(2) // High Price
    const t3 = getTeamResult(3) // Low Price

    // Access prices from replayed decisions and desired units from audit trace.
    const p1 = t1.decisions.marketing.us.price
    const p2 = t2.decisions.marketing.us.price
    const p3 = t3.decisions.marketing.us.price

    const d1 = t1.audit.desiredUnits.us
    const d2 = t2.audit.desiredUnits.us
    const d3 = t3.audit.desiredUnits.us

    console.log(`  🔹 Control Price: $${p1} -> Demand: ${d1.toLocaleString()}`)
    console.log(`  🔺 High Price:    $${p2} -> Demand: ${d2.toLocaleString()}`)
    console.log(`  🔻 Low Price:     $${p3} -> Demand: ${d3.toLocaleString()}`)

    if (d3 > d1 && d1 > d2) {
        console.log('  ✅ SUCCESS: Demand responded inversely to price as expected.')
    } else {
        console.error('  ❌ FAILURE: Demand did not respond correctly to price.')
    }

    // 2. Investment Lag Check (Pre-check)
    console.log('\n🏗️ Investment Check (Round 1):')
    const t4 = getTeamResult(4)
    console.log(`  Initial US Factories: ${gameStates.get(4)!.factories.us}`)
    console.log(`  Ordered: ${t4.gameState.pendingInvestments.length > 0 ? t4.gameState.pendingInvestments[0].plantsOrdered : 0} plants`)
    console.log(`  R1 Ending Factories: ${t4.gameState.factories.us}`)

    if (t4.gameState.factories.us === gameStates.get(4)!.factories.us) {
        console.log('  ✅ SUCCESS: Factories did not increase immediately (Lag works).')
    } else {
        console.error('  ❌ FAILURE: Factories increased immediately!')
    }

    // 3. R&D Check
    console.log('\n💡 R&D Check (Round 1):')
    const t5 = getTeamResult(5)
    console.log(`  Research Staff: ${t5.decisions.rnd.researchStaff}`)
    console.log(`  Hours Generated: ${t5.gameState.rndProgress.cumulativeResearchHours.toLocaleString()}`)
    console.log(`  Features Unlocked: ${t5.gameState.rndProgress.unlockedFeatureCount}`)

    // --- ROUND 2 SIMULATION ---
    console.log('\n--- 🏁 ROUND 2 SIMULATION ---')

    // Update game states for Round 2
    const r2GameStates = new Map<number, TeamGameState>()
    r1Results.teams.forEach(t => {
        r2GameStates.set(t.teamId, t.gameState)
    })

    // Round 2 Decisions (mostly empty, just carry over)
    const r2InputTeams = r1Decisions.map((d, i) => ({
        id: d.id,
        name: teams[i].name,
        decisions: { ...d.decisions, investment: { newPlantsUS: 0, newPlantsAsia: 0 } } // No new investment
    }))

    const r2Results = calculateRound(r2InputTeams, 2, r2GameStates, [0, 0], 1, config)

    // --- VERIFY ROUND 2 ---

    // 1. Investor Lag Check (Post-check)
    console.log('\n🏗️ Investment Check (Round 2):')
    const t4_r2 = r2Results.teams.find(t => t.teamId === 4)!
    console.log(`  R2 Ending Factories: ${t4_r2.gameState.factories.us}`)

    if (t4_r2.gameState.factories.us === gameStates.get(4)!.factories.us + 1) {
        console.log('  ✅ SUCCESS: Factory became operational in Round 2.')
    } else {
        console.error(`  ❌ FAILURE: Factory count mismatch. Expected ${gameStates.get(4)!.factories.us + 1}, Got ${t4_r2.gameState.factories.us}`)
    }

    console.log('\n✅ Verification Complete.')
}

runVerification()
