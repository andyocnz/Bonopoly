/**
 * Scenario Builder Component
 *
 * Allows educators to create custom economic scenarios
 */

import { useState } from 'react'
import type { RoundScenario } from '../engine/gameEngine'
import { InfoTooltip } from './InfoTooltip'

interface ScenarioBuilderProps {
  onClose: () => void
  onSave: (scenario: Partial<RoundScenario>) => void
  existingScenario?: RoundScenario
}

export function ScenarioBuilder({ onClose, onSave, existingScenario }: ScenarioBuilderProps) {
  const [name, setName] = useState(existingScenario?.name || '')
  const [description, setDescription] = useState(existingScenario?.description || '')

  // Demand modifiers
  const [demandUS, setDemandUS] = useState(existingScenario?.demandModifier.us || 0)
  const [demandAsia, setDemandAsia] = useState(existingScenario?.demandModifier.asia || 0)
  const [demandEurope, setDemandEurope] = useState(existingScenario?.demandModifier.europe || 0)

  // Market conditions
  const [priceElasticity, setPriceElasticity] = useState(existingScenario?.priceElasticityModifier || 1.0)
  const [csrImportance, setCsrImportance] = useState(existingScenario?.csrImportanceModifier || 1.0)
  const [marketingEffect, setMarketingEffect] = useState(existingScenario?.marketingEffectModifier || 1.0)

  // Cost factors
  const [costInflation, setCostInflation] = useState(existingScenario?.costInflation || 1.0)
  const [investmentCost, setInvestmentCost] = useState(existingScenario?.investmentCostMultiplier || 1.0)
  const [interestRate, setInterestRate] = useState(existingScenario?.interestRateSpread || 0)

  const handleSave = () => {
    const scenario: Partial<RoundScenario> = {
      name,
      description,
      demandModifier: {
        us: demandUS,
        asia: demandAsia,
        europe: demandEurope,
      },
      priceElasticityModifier: priceElasticity,
      csrImportanceModifier: csrImportance,
      marketingEffectModifier: marketingEffect,
      costInflation,
      investmentCostMultiplier: investmentCost,
      interestRateSpread: interestRate,
      taxRateDeltaByRegion: { us: 0, asia: 0, europe: 0 },
      workingCapitalDelta: { inventory: 0, receivable: 0, payable: 0 },
      logisticsTariff: {},
      hints: [],
    }
    onSave(scenario)
  }

  return (
    <div
      onClick={onClose}
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sl-scenario-modal"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '2rem',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-main)' }}>
          {existingScenario ? 'Edit Scenario' : 'Create Custom Scenario'}
        </h2>

        {/* Basic Info */}
        <div className="sl-form-group">
          <label className="sl-label">Scenario Name</label>
          <input
            type="text"
            className="sl-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Tech Bubble Burst"
          />
        </div>

        <div className="sl-form-group">
          <label className="sl-label">Description</label>
          <textarea
            className="sl-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the economic conditions..."
            rows={3}
          />
        </div>

        {/* Demand Modifiers */}
        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-main)' }}>
          Regional Demand Changes
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="sl-form-group">
            <label className="sl-label">
              US Demand
              <InfoTooltip content="Percentage change in US market demand. +20 = 20% increase, -15 = 15% decrease." />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                className="sl-input"
                value={demandUS}
                onChange={(e) => setDemandUS(parseFloat(e.target.value) || 0)}
                step="5"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
            </div>
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              Asia Demand
              <InfoTooltip content="Percentage change in Asia market demand." />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                className="sl-input"
                value={demandAsia}
                onChange={(e) => setDemandAsia(parseFloat(e.target.value) || 0)}
                step="5"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
            </div>
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              Europe Demand
              <InfoTooltip content="Percentage change in Europe market demand." />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                className="sl-input"
                value={demandEurope}
                onChange={(e) => setDemandEurope(parseFloat(e.target.value) || 0)}
                step="5"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
            </div>
          </div>
        </div>

        {/* Market Conditions */}
        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-main)' }}>
          Market Conditions
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="sl-form-group">
            <label className="sl-label">
              Price Elasticity
              <InfoTooltip content="How sensitive demand is to price changes. 1.0 = normal, 1.5 = 50% more sensitive (price wars), 0.7 = less sensitive (brand loyalty)." />
            </label>
            <input
              type="number"
              className="sl-input"
              value={priceElasticity}
              onChange={(e) => setPriceElasticity(parseFloat(e.target.value) || 1.0)}
              step="0.1"
              min="0.1"
              max="3.0"
            />
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              CSR Importance
              <InfoTooltip content="How much consumers care about corporate social responsibility. 1.0 = normal, 1.5 = green wave, 0.5 = only price matters." />
            </label>
            <input
              type="number"
              className="sl-input"
              value={csrImportance}
              onChange={(e) => setCsrImportance(parseFloat(e.target.value) || 1.0)}
              step="0.1"
              min="0.1"
              max="3.0"
            />
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              Marketing Effectiveness
              <InfoTooltip content="How effective marketing spend is at driving sales. 1.0 = normal, 1.5 = highly effective, 0.6 = saturated market." />
            </label>
            <input
              type="number"
              className="sl-input"
              value={marketingEffect}
              onChange={(e) => setMarketingEffect(parseFloat(e.target.value) || 1.0)}
              step="0.1"
              min="0.1"
              max="2.0"
            />
          </div>
        </div>

        {/* Cost Factors */}
        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-main)' }}>
          Cost & Investment
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="sl-form-group">
            <label className="sl-label">
              Cost Inflation
              <InfoTooltip content="Multiplier on production costs. 1.0 = normal, 1.15 = 15% higher costs, 0.92 = cost reduction." />
            </label>
            <input
              type="number"
              className="sl-input"
              value={costInflation}
              onChange={(e) => setCostInflation(parseFloat(e.target.value) || 1.0)}
              step="0.05"
              min="0.5"
              max="2.0"
            />
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              Investment Cost
              <InfoTooltip content="Multiplier on factory construction costs. 1.0 = normal, 1.35 = 35% more expensive to build capacity." />
            </label>
            <input
              type="number"
              className="sl-input"
              value={investmentCost}
              onChange={(e) => setInvestmentCost(parseFloat(e.target.value) || 1.0)}
              step="0.05"
              min="0.5"
              max="2.0"
            />
          </div>

          <div className="sl-form-group">
            <label className="sl-label">
              Interest Rate Spread
              <InfoTooltip content="Change in borrowing costs. 0.03 = +3% interest rate (credit tightening), -0.03 = -3% (easy money)." />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                className="sl-input"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="-0.10"
                max="0.10"
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
          <button
            className="sl-btn-nav"
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Cancel
          </button>
          <button
            className="sl-btn-run"
            onClick={handleSave}
            disabled={!name || !description}
            style={{ padding: '0.75rem 1.5rem' }}
          >
            {existingScenario ? 'Save Changes' : 'Create Scenario'}
          </button>
        </div>
      </div>
    </div>
  )
}
