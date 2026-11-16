import { useState } from 'react'
import { SupplyDemandChart } from './economics/SupplyDemandChart'
import { PriceElasticityChart } from './economics/PriceElasticityChart'
import { MarketShareChart } from './economics/MarketShareChart'
import { RevenueProfitChart } from './economics/RevenueProfitChart'
import { ProductionPossibilityChart } from './economics/ProductionPossibilityChart'
import { DemandShiftsChart } from './economics/DemandShiftsChart'
import { CapacityCostChart } from './economics/CapacityCostChart'
import type { TeamRow } from '../utils/normalizeTeamRow'

interface MarketEconomicsSectionProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[]; marketDemand?: { us: number; asia: number; europe: number } }>
  roundNumber: number
  regionLabels: { us: string; asia: string; europe: string }
}

type EconTab = 'pricing' | 'competition' | 'production' | 'shocks'

const ECON_TABS: Array<{ id: EconTab; label: string; icon: string }> = [
  { id: 'pricing', label: 'Pricing', icon: '💰' },
  { id: 'competition', label: 'Competition', icon: '⚔️' },
  { id: 'production', label: 'Production', icon: '🏭' },
  { id: 'shocks', label: 'Market Shocks', icon: '📉' },
]

export function MarketEconomicsSection({
  currentTeamData,
  allRoundsData,
  roundNumber,
  regionLabels,
}: MarketEconomicsSectionProps) {
  const [activeTab, setActiveTab] = useState<EconTab>('pricing')

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '32px',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '0',
      }}>
        {ECON_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--text-accent)' : '3px solid transparent',
              color: activeTab === tab.id ? 'var(--text-accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-2px',
            }}
          >
            <span style={{ marginRight: '6px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'pricing' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>
              📌 Pricing Economics
            </h3>

            {/* Supply & Demand Chart */}
            <SupplyDemandChart
              allRoundsData={allRoundsData}
              roundNumber={roundNumber}
              regionLabels={regionLabels}
            />

            {/* Price Elasticity Chart */}
            <PriceElasticityChart
              allRoundsData={allRoundsData}
            />

            {/* Revenue vs Profit Chart */}
            <RevenueProfitChart
              allRoundsData={allRoundsData}
              roundNumber={roundNumber}
            />
          </div>
        )}

        {activeTab === 'competition' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>
              ⚔️ Competitive Dynamics
            </h3>

            {/* Market Share Chart */}
            <MarketShareChart
              currentTeamData={currentTeamData}
              allRoundsData={allRoundsData}
              regionLabels={regionLabels}
            />
          </div>
        )}

        {activeTab === 'production' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>
              🏭 Production Economics
            </h3>


            {/* Production Possibility Frontier Chart */}
            <ProductionPossibilityChart
              currentTeamData={currentTeamData}
              allRoundsData={allRoundsData}
              regionLabels={regionLabels}
            />

            {/* Capacity Cost Curve */}
            <CapacityCostChart
              currentTeamData={currentTeamData}
              allRoundsData={allRoundsData}
              regionLabels={regionLabels}
            />
          </div>
        )}

        {activeTab === 'shocks' && (
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', color: 'var(--text-main)' }}>
              📉 Market Shocks & External Factors
            </h3>

            {/* Demand Shifts Chart */}
            <DemandShiftsChart
              currentTeamData={currentTeamData}
              allRoundsData={allRoundsData}
              regionLabels={regionLabels}
            />
          </div>
        )}
      </div>
    </div>
  )
}

