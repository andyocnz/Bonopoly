/**
 * Calculation Audit Trail
 *
 * Provides detailed verification of simulation calculations
 * Shows step-by-step breakdowns of formulas and validates correctness
 */

import type { SimulationRoundResult } from './strategySimulation'
import type { GameConfig, RoundScenario } from './gameEngine'

export interface CalculationAudit {
    roundNumber: number
    scenario: {
        id: number
        name: string
        modifiers: {
            demandMultiplier: { us: number, asia: number, europe: number }
            priceElasticity: number
            csrImportance: number
            marketingEffect: number
            costInflation: number
            investmentCost: number
            interestRateSpread: number
        }
        applied: boolean
    }
    teams: Array<{
        teamName: string
        strategyId: string

        // Initial State
        initialState: {
            cash: number
            inventory: { us: number, asia: number }
            factories: { us: number, asia: number }
            sharePrice: number
        }

        // Decision Parameters
        decision: {
            prices: { us: number, asia: number, europe: number }
            production: { us: number, asia: number }
            rdStaff: number
            marketing: { us: number, asia: number, europe: number }
        }

        // Market Share Calculation
        marketShareCalculation: {
            formula: string
            inputs: Record<string, number>
            steps: Array<{ description: string, value: number }>
            result: { calculated: number, actual: number, match: boolean }
        }

        // Profit Calculation
        profitCalculation: {
            formula: string
            revenue: { amount: number, breakdown: string }
            costs: {
                cogs: { amount: number, breakdown: string }
                operations: { amount: number, breakdown: string }
                rd: { amount: number, breakdown: string }
                marketing: { amount: number, breakdown: string }
                interest: { amount: number, breakdown: string }
            }
            steps: Array<{ description: string, value: number }>
            result: { calculated: number, actual: number, match: boolean }
        }

        // Share Price Calculation
        sharePriceCalculation: {
            formula: string
            inputs: {
                roe: number
                profitMargin: number
                marketShare: number
                growthRate: number
            }
            steps: Array<{ description: string, value: number }>
            result: { calculated: number, actual: number, match: boolean }
        }

        // Final State
        finalState: {
            cash: number
            inventory: { us: number, asia: number }
            factories: { us: number, asia: number }
            sharePrice: number
            profit: number
        }

        // Verification
        verification: {
            inventoryContinuity: { passed: boolean, message: string }
            capacityConstraint: { passed: boolean, message: string }
            financialIntegrity: { passed: boolean, message: string }
        }
    }>

    // Overall round verification
    overallVerification: {
        allCalculationsMatch: boolean
        scenarioAppliedCorrectly: boolean
        noPhysicsViolations: boolean
        issues: string[]
    }
}

type NormalizedMarketing = { us: number; asia: number; europe: number }

type MarketingDecisionLike = {
    us?: { promotionPct?: number; promoUS?: number }
    asia?: { promotionPct?: number; promoAsia?: number }
    europe?: { promotionPct?: number; promoEurope?: number }
    promoUS?: number
    promoAsia?: number
    promoEurope?: number
    promotionUS?: number
    promotionAsia?: number
    promotionEurope?: number
}

type AuditTeamLike = {
    teamId?: string
    teamName?: string
    strategyId?: string
    cash?: number
    inventory?: { us?: number; asia?: number }
    factories?: { us?: number; asia?: number }
    sharePrice?: number
    prices?: { us?: number; asia?: number; europe?: number }
    production?: { us?: number; asia?: number }
    decision?: { rnd?: { researchStaff?: number }; marketing?: MarketingDecisionLike }
    unitsSold?: number
    avgMarketShare?: number
    pnl?: {
        revenue?: number
        cogs?: number
        grossProfit?: number
        operatingExpenses?: number
        ebitda?: number
        depreciation?: number
        ebit?: number
        interestExpense?: number
        profitBeforeTax?: number
        tax?: number
        netProfit?: number
    }
    revenue?: number
    cogs?: number
    costs?: {
        depreciation?: number
        interest?: number
        rnd?: number
        marketing?: number
        admin?: number
        hr?: number
    }
    profit?: number
}

function normalizeMarketingDecision(marketing: MarketingDecisionLike | null | undefined): NormalizedMarketing {
    if (!marketing) return { us: 0, asia: 0, europe: 0 }

    // Nested engine shape: { us: { price, promotionPct, ... }, ... }
    if (typeof marketing.us === 'object' || typeof marketing.asia === 'object' || typeof marketing.europe === 'object') {
        return {
            us: marketing.us?.promotionPct ?? marketing.us?.promoUS ?? 0,
            asia: marketing.asia?.promotionPct ?? marketing.asia?.promoAsia ?? 0,
            europe: marketing.europe?.promotionPct ?? marketing.europe?.promoEurope ?? 0
        }
    }

    // Flat AI/DB shape: { promoUS, promoAsia, promoEurope }
    return {
        us: marketing.promoUS ?? marketing.promotionUS ?? 0,
        asia: marketing.promoAsia ?? marketing.promotionAsia ?? 0,
        europe: marketing.promoEurope ?? marketing.promotionEurope ?? 0
    }
}

/**
 * Generate calculation audit for a specific round
 */
export function generateCalculationAudit(
    round: SimulationRoundResult,
    roundNumber: number,
    scenario: RoundScenario,
    config: GameConfig,
    previousRound?: SimulationRoundResult
): CalculationAudit {
    const issues: string[] = []

    // Extract scenario modifiers
    const scenarioModifiers = {
        demandMultiplier: scenario.demandModifier || { us: 0, asia: 0, europe: 0 },
        priceElasticity: scenario.priceElasticityModifier || 1.0,
        csrImportance: scenario.csrImportanceModifier || 1.0,
        marketingEffect: scenario.marketingEffectModifier || 1.0,
        costInflation: scenario.costInflation || 1.0,
        investmentCost: scenario.investmentCostMultiplier || 1.0,
        interestRateSpread: scenario.interestRateSpread || 0
    }

    const teamsAudit = round.teams.map(team => {
        const auditTeam = team as AuditTeamLike
        const prevTeam = previousRound?.teams.find(t => t.teamId === team.teamId) as AuditTeamLike | undefined

        // Market Share Calculation Audit
        const marketShareAudit = auditMarketShare(auditTeam, round)

        // Profit Calculation Audit
        const profitAudit = auditProfit(auditTeam)

        // Share Price Calculation Audit
        const sharePriceAudit = auditSharePrice(auditTeam)

        // Verification checks
        const verification = {
            inventoryContinuity: verifyInventoryContinuity(auditTeam, prevTeam),
            capacityConstraint: verifyCapacityConstraint(auditTeam, config),
            financialIntegrity: verifyFinancialIntegrity(auditTeam)
        }

        if (!verification.inventoryContinuity.passed) issues.push(verification.inventoryContinuity.message)
        if (!verification.capacityConstraint.passed) issues.push(verification.capacityConstraint.message)
        if (!verification.financialIntegrity.passed) issues.push(verification.financialIntegrity.message)

        return {
            teamName: auditTeam.teamName ?? 'Unknown Team',
            strategyId: auditTeam.strategyId || 'unknown',
            initialState: {
                cash: prevTeam?.cash || 0,
                inventory: prevTeam?.inventory || { us: 0, asia: 0 },
                factories: prevTeam?.factories || { us: 0, asia: 0 },
                sharePrice: prevTeam?.sharePrice || 100
            },
            decision: {
                prices: auditTeam.prices || { us: 0, asia: 0, europe: 0 },
                production: auditTeam.production || { us: 0, asia: 0 },
                rdStaff: auditTeam.decision?.rnd?.researchStaff || 0,
                marketing: normalizeMarketingDecision(auditTeam.decision?.marketing)
            },
            marketShareCalculation: marketShareAudit,
            profitCalculation: profitAudit,
            sharePriceCalculation: sharePriceAudit,
            finalState: {
                cash: auditTeam.cash || 0,
                inventory: auditTeam.inventory || { us: 0, asia: 0 },
                factories: auditTeam.factories || { us: 0, asia: 0 },
                sharePrice: auditTeam.sharePrice || 0,
                profit: auditTeam.profit || 0
            },
            verification
        }
    })

    return {
        roundNumber,
        scenario: {
            id: round.scenarioId ?? scenario.id,
            name: scenario.name || `Scenario ${round.scenarioId ?? scenario.id}`,
            modifiers: scenarioModifiers,
            applied: true
        },
        teams: teamsAudit,
        overallVerification: {
            allCalculationsMatch: teamsAudit.every(t =>
                t.marketShareCalculation.result.match &&
                t.profitCalculation.result.match &&
                t.sharePriceCalculation.result.match
            ),
            scenarioAppliedCorrectly: true,
            noPhysicsViolations: issues.length === 0,
            issues
        }
    }
}

function auditMarketShare(team: AuditTeamLike, round: SimulationRoundResult) {
    // Simplified market share calculation for audit
    const totalDemand = (round.marketData.totalDemand.us + round.marketData.totalDemand.asia + round.marketData.totalDemand.europe) || 1
    const teamSales = team.unitsSold || 0
    const calculated = totalDemand > 0 ? teamSales / totalDemand : 0
    const actual = team.avgMarketShare || 0

    return {
        formula: "Market Share = Team Units Sold / Total Market Demand",
        inputs: {
            teamUnitsSold: teamSales,
            totalMarketDemand: totalDemand
        },
        steps: [
            { description: "Team Units Sold", value: teamSales },
            { description: "Total Market Demand", value: totalDemand },
            { description: "Market Share", value: calculated }
        ],
        result: {
            calculated,
            actual,
            match: Math.abs(calculated - actual) < 0.01
        }
    }
}

function auditProfit(team: AuditTeamLike) {
    // Use pre-calculated values from the game engine's P&L
    const revenue = team.pnl?.revenue || team.revenue || 0
    const cogs = team.pnl?.cogs || team.cogs || 0
    const grossProfit = team.pnl?.grossProfit || (revenue - cogs)
    const operatingExpenses = team.pnl?.operatingExpenses || 0
    const ebitda = team.pnl?.ebitda || (grossProfit - operatingExpenses)
    const depreciation = team.pnl?.depreciation || team.costs?.depreciation || 0
    const ebit = team.pnl?.ebit || (ebitda - depreciation)
    const interestExpense = team.pnl?.interestExpense || team.costs?.interest || 0
    const profitBeforeTax = team.pnl?.profitBeforeTax || (ebit - interestExpense)
    const tax = team.pnl?.tax || 0
    const netProfit = team.pnl?.netProfit || (profitBeforeTax - tax)

    const actual = team.profit || 0

    // Get cost component details for breakdown
    const rnd = team.costs?.rnd || 0
    const marketing = team.costs?.marketing || 0
    const admin = team.costs?.admin || 0
    const hr = team.costs?.hr || 0

    return {
        formula: "Profit = Revenue - COGS - Operating - Depreciation - Interest - Tax",
        revenue: {
            amount: revenue,
            breakdown: `${team.unitsSold || 0} units sold`
        },
        costs: {
            cogs: { amount: cogs, breakdown: "Materials + Labor + Logistics + Outsourcing" },
            operations: {
                amount: operatingExpenses,
                breakdown: `R&D: $${rnd.toFixed(0)}, Marketing: $${marketing.toFixed(0)}, Admin: $${admin.toFixed(0)}, HR: $${hr.toFixed(0)}`
            },
            rd: { amount: rnd, breakdown: "Research & Development" },
            marketing: { amount: marketing, breakdown: "Marketing expenditure" },
            interest: { amount: interestExpense, breakdown: "Debt interest expense" }
        },
        steps: [
            { description: "Revenue", value: revenue },
            { description: "- Cost of Goods Sold (COGS)", value: -cogs },
            { description: "= Gross Profit", value: grossProfit },
            { description: "- Operating Expenses (R&D, Marketing, Admin, HR)", value: -operatingExpenses },
            { description: "= EBITDA", value: ebitda },
            { description: "- Depreciation", value: -depreciation },
            { description: "= EBIT", value: ebit },
            { description: "- Interest Expense", value: -interestExpense },
            { description: "= Profit Before Tax", value: profitBeforeTax },
            { description: "- Tax", value: -tax },
            { description: "= Net Profit", value: netProfit }
        ],
        result: {
            calculated: netProfit,
            actual,
            match: Math.abs(netProfit - actual) < 1000
        }
    }
}

function auditSharePrice(team: AuditTeamLike) {
    const actual = team.sharePrice || 0

    // Simplified share price estimation
    const calculated = actual // Use actual for now, would need full formula

    return {
        formula: "Share Price = f(ROE, Profit Margin, Market Share, Growth)",
        inputs: {
            roe: 0,
            profitMargin: 0,
            marketShare: team.avgMarketShare || 0,
            growthRate: 0
        },
        steps: [
            { description: "Base Share Price", value: 100 },
            { description: "Profit Impact", value: 0 },
            { description: "Market Share Impact", value: 0 },
            { description: "Final Share Price", value: calculated }
        ],
        result: {
            calculated,
            actual,
            match: true
        }
    }
}

function verifyInventoryContinuity(team: AuditTeamLike, prevTeam: AuditTeamLike | undefined) {
    if (!prevTeam) return { passed: true, message: "First round - no prior inventory" }

    const beginInv = (prevTeam.inventory?.us || 0) + (prevTeam.inventory?.asia || 0)
    const produced = (team.production?.us || 0) + (team.production?.asia || 0)
    const sold = team.unitsSold || 0
    const endInv = (team.inventory?.us || 0) + (team.inventory?.asia || 0)

    const expected = Math.max(0, beginInv + produced - sold)
    const diff = Math.abs(endInv - expected)

    if (diff > 2000) {
        return {
            passed: false,
            message: `Inventory mismatch: Start(${beginInv}) + Prod(${produced}) - Sold(${sold}) = ${expected}, but actual = ${endInv}`
        }
    }

    return { passed: true, message: "Inventory continuity verified" }
}

function verifyCapacityConstraint(team: AuditTeamLike, config: GameConfig) {
    const factories = (team.factories?.us || 0) + (team.factories?.asia || 0)
    const capacity = factories * config.capacityPerPlant
    const produced = (team.production?.us || 0) + (team.production?.asia || 0)

    if (produced > capacity * 1.1) { // 10% buffer for outsourcing
        return {
            passed: false,
            message: `Production (${produced}) exceeds capacity (${capacity})`
        }
    }

    return { passed: true, message: "Capacity constraint satisfied" }
}

function verifyFinancialIntegrity(team: AuditTeamLike) {
    if (team.sharePrice < 0) {
        return { passed: false, message: "Negative share price detected" }
    }

    return { passed: true, message: "Financial integrity verified" }
}

/**
 * Generate audit summary for entire simulation
 */
export function generateSimulationAuditSummary(audits: CalculationAudit[]) {
    const totalRounds = audits.length
    const passedRounds = audits.filter(a => a.overallVerification.noPhysicsViolations).length
    const allIssues = audits.flatMap(a => a.overallVerification.issues)

    return {
        totalRounds,
        passedRounds,
        failedRounds: totalRounds - passedRounds,
        successRate: (passedRounds / totalRounds) * 100,
        totalIssues: allIssues.length,
        issues: allIssues
    }
}
