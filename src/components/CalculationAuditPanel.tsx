/**
 * Calculation Audit Panel
 *
 * Shows detailed breakdown of simulation calculations
 * Verifies formulas and parameters are correct
 */

import { useState } from 'react'
import type { CalculationAudit } from '../engine/calculationAudit'

interface CalculationAuditPanelProps {
    audits: CalculationAudit[]
    theme: 'light' | 'dark'
}

export function CalculationAuditPanel({ audits, theme }: CalculationAuditPanelProps) {
    const [selectedRound, setSelectedRound] = useState(audits.length > 0 ? audits[audits.length - 1].roundNumber : 1)
    const [selectedTeam, setSelectedTeam] = useState(0)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['scenario', 'marketShare']))

    const audit = audits.find(a => a.roundNumber === selectedRound)
    if (!audit) return <div>No audit data available</div>

    const team = audit.teams[selectedTeam]
    if (!team) return <div>No team data available</div>

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections)
        if (newExpanded.has(section)) {
            newExpanded.delete(section)
        } else {
            newExpanded.add(section)
        }
        setExpandedSections(newExpanded)
    }

    const verificationIcon = (passed: boolean) => passed ? '✅' : '⚠️'
    const matchIcon = (match: boolean) => match ? '✅' : '❌'

    return (
        <div style={{
            background: theme === 'dark' ? '#0f172a' : '#f8fafc',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px',
            padding: '1.5rem',
            marginTop: '2rem'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: `2px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    color: 'var(--text-main)',
                    fontWeight: 600
                }}>
                    🔍 Calculation Audit Trail
                </h3>
                <div style={{
                    fontSize: '0.85rem',
                    color: audit.overallVerification.noPhysicsViolations ? '#10b981' : '#ef4444',
                    fontWeight: 600
                }}>
                    {audit.overallVerification.noPhysicsViolations ? '✅ All Checks Passed' : '⚠️ Issues Detected'}
                </div>
            </div>

            {/* Round Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-main)'
                }}>
                    Select Round
                </label>
                <select
                    value={selectedRound}
                    onChange={(e) => setSelectedRound(Number(e.target.value))}
                    style={{
                        width: '200px',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                        background: theme === 'dark' ? '#1e293b' : '#fff',
                        color: 'var(--text-main)',
                        fontSize: '0.875rem'
                    }}
                >
                    {audits.map(a => (
                        <option key={a.roundNumber} value={a.roundNumber}>
                            Round {a.roundNumber}
                        </option>
                    ))}
                </select>
            </div>

            {/* Scenario Section */}
            <AuditSection
                title="📊 Scenario & Modifiers"
                isExpanded={expandedSections.has('scenario')}
                onToggle={() => toggleSection('scenario')}
                theme={theme}
            >
                <div style={{ padding: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <strong>Scenario:</strong> {audit.scenario.name} (ID: {audit.scenario.id})
                    </div>
                    <table style={{
                        width: '100%',
                        fontSize: '0.85rem',
                        borderCollapse: 'collapse'
                    }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Demand Multiplier</td>
                                <td style={{ padding: '0.5rem' }}>
                                    US: {(audit.scenario.modifiers.demandMultiplier.us * 100).toFixed(0)}%,
                                    Asia: {(audit.scenario.modifiers.demandMultiplier.asia * 100).toFixed(0)}%,
                                    EU: {(audit.scenario.modifiers.demandMultiplier.europe * 100).toFixed(0)}%
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Price Elasticity</td>
                                <td style={{ padding: '0.5rem' }}>{audit.scenario.modifiers.priceElasticity.toFixed(2)}x</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>CSR Importance</td>
                                <td style={{ padding: '0.5rem' }}>{audit.scenario.modifiers.csrImportance.toFixed(2)}x</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Cost Inflation</td>
                                <td style={{ padding: '0.5rem' }}>{audit.scenario.modifiers.costInflation.toFixed(2)}x</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AuditSection>

            {/* Team Selector */}
            <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-main)'
                }}>
                    Select Team
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {audit.teams.map((t, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedTeam(idx)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                border: selectedTeam === idx
                                    ? '2px solid var(--pro-primary)'
                                    : `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                                background: selectedTeam === idx
                                    ? (theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)')
                                    : (theme === 'dark' ? '#1e293b' : '#fff'),
                                color: selectedTeam === idx ? 'var(--pro-primary)' : 'var(--text-main)',
                                fontSize: '0.875rem',
                                fontWeight: selectedTeam === idx ? 600 : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {t.teamName}
                        </button>
                    ))}
                </div>
            </div>

            {/* Market Share Calculation */}
            <AuditSection
                title="📈 Market Share Calculation"
                isExpanded={expandedSections.has('marketShare')}
                onToggle={() => toggleSection('marketShare')}
                theme={theme}
                status={matchIcon(team.marketShareCalculation.result.match)}
            >
                <CalculationDetails
                    formula={team.marketShareCalculation.formula}
                    inputs={team.marketShareCalculation.inputs}
                    steps={team.marketShareCalculation.steps}
                    result={team.marketShareCalculation.result}
                    theme={theme}
                />
            </AuditSection>

            {/* Profit Calculation */}
            <AuditSection
                title="💰 Profit Calculation"
                isExpanded={expandedSections.has('profit')}
                onToggle={() => toggleSection('profit')}
                theme={theme}
                status={matchIcon(team.profitCalculation.result.match)}
            >
                <CalculationDetails
                    formula={team.profitCalculation.formula}
                    inputs={{
                        revenue: team.profitCalculation.revenue.amount,
                        cogs: team.profitCalculation.costs.cogs.amount
                    }}
                    steps={team.profitCalculation.steps}
                    result={team.profitCalculation.result}
                    theme={theme}
                />
            </AuditSection>

            {/* Share Price Calculation */}
            <AuditSection
                title="📊 Share Price Calculation"
                isExpanded={expandedSections.has('sharePrice')}
                onToggle={() => toggleSection('sharePrice')}
                theme={theme}
                status={matchIcon(team.sharePriceCalculation.result.match)}
            >
                <CalculationDetails
                    formula={team.sharePriceCalculation.formula}
                    inputs={team.sharePriceCalculation.inputs}
                    steps={team.sharePriceCalculation.steps}
                    result={team.sharePriceCalculation.result}
                    theme={theme}
                />
            </AuditSection>

            {/* Verification Section */}
            <AuditSection
                title="✓ Physics Verification"
                isExpanded={expandedSections.has('verification')}
                onToggle={() => toggleSection('verification')}
                theme={theme}
            >
                <div style={{ padding: '1rem' }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <VerificationItem
                            icon={verificationIcon(team.verification.inventoryContinuity.passed)}
                            label="Inventory Continuity"
                            message={team.verification.inventoryContinuity.message}
                            passed={team.verification.inventoryContinuity.passed}
                        />
                        <VerificationItem
                            icon={verificationIcon(team.verification.capacityConstraint.passed)}
                            label="Capacity Constraint"
                            message={team.verification.capacityConstraint.message}
                            passed={team.verification.capacityConstraint.passed}
                        />
                        <VerificationItem
                            icon={verificationIcon(team.verification.financialIntegrity.passed)}
                            label="Financial Integrity"
                            message={team.verification.financialIntegrity.message}
                            passed={team.verification.financialIntegrity.passed}
                        />
                    </div>
                </div>
            </AuditSection>
        </div>
    )
}

// Helper Components

interface AuditSectionProps {
    title: string
    isExpanded: boolean
    onToggle: () => void
    theme: 'light' | 'dark'
    status?: string
    children: React.ReactNode
}

function AuditSection({ title, isExpanded, onToggle, theme, status, children }: AuditSectionProps) {
    return (
        <div style={{
            marginTop: '1rem',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
            borderRadius: '8px',
            overflow: 'hidden'
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%',
                    padding: '1rem',
                    background: theme === 'dark' ? '#1e293b' : '#f8fafc',
                    border: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--text-main)'
                }}
            >
                <span>{title}</span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {status && <span>{status}</span>}
                    <span>{isExpanded ? '▼' : '▶'}</span>
                </span>
            </button>
            {isExpanded && (
                <div style={{
                    background: theme === 'dark' ? '#0f172a' : '#fff',
                    borderTop: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`
                }}>
                    {children}
                </div>
            )}
        </div>
    )
}

interface CalculationDetailsProps {
    formula: string
    inputs: Record<string, number>
    steps: Array<{ description: string, value: number }>
    result: { calculated: number, actual: number, match: boolean }
    theme: 'light' | 'dark'
}

function CalculationDetails({ formula, inputs, steps, result, theme }: CalculationDetailsProps) {
    return (
        <div style={{ padding: '1rem' }}>
            {/* Formula */}
            <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                border: `1px solid ${theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                color: 'var(--text-main)'
            }}>
                <strong>Formula:</strong> {formula}
            </div>

            {/* Inputs */}
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    Inputs:
                </div>
                {Object.entries(inputs).map(([key, value]) => (
                    <div key={key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0',
                        fontSize: '0.85rem'
                    }}>
                        <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                        <span style={{ fontFamily: 'monospace' }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
                    </div>
                ))}
            </div>

            {/* Steps */}
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    Calculation Steps:
                </div>
                {steps.map((step, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0',
                        fontSize: '0.85rem'
                    }}>
                        <span style={{ color: 'var(--text-muted)' }}>{step.description}:</span>
                        <span style={{ fontFamily: 'monospace' }}>{step.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>

            {/* Result Comparison */}
            <div style={{
                padding: '0.75rem',
                background: result.match
                    ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)')
                    : (theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'),
                border: `1px solid ${result.match
                    ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)')
                    : (theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)')}`,
                borderRadius: '6px',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Calculated:</span>
                    <span style={{ fontFamily: 'monospace' }}>{result.calculated.toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Actual:</span>
                    <span style={{ fontFamily: 'monospace' }}>{result.actual.toFixed(4)}</span>
                </div>
                <div style={{
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                    fontWeight: 600,
                    color: result.match ? '#10b981' : '#ef4444'
                }}>
                    {result.match ? '✅ Calculation Verified' : '❌ Mismatch Detected'}
                </div>
            </div>
        </div>
    )
}

interface VerificationItemProps {
    icon: string
    label: string
    message: string
    passed: boolean
}

function VerificationItem({ icon, label, message, passed }: VerificationItemProps) {
    return (
        <div style={{
            padding: '0.75rem',
            background: passed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            border: `1px solid ${passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            borderRadius: '6px'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 600
            }}>
                <span>{icon}</span>
                <span>{label}</span>
            </div>
            <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginLeft: '1.5rem'
            }}>
                {message}
            </div>
        </div>
    )
}
