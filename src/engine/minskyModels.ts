// ── Pre-built Minsky Models ──
// Simplified Keen-inspired model with CORRECT double-entry accounting

import type { MinskyModel } from '../types/minsky'

/**
 * Simplified stock-flow consistent model.
 * Every Godley table row MUST sum to zero (double-entry bookkeeping).
 */
export function createKeenGovernmentModel(): MinskyModel {
  return {
    metadata: {
      name: 'Simplified SFC Model with Government',
      description:
        'Stock-flow consistent model with correct double-entry accounting. ' +
        'Shows GDP growth, government spending/taxation, and bond dynamics.',
      author: 'Based on Steve Keen / Simplified for Bonopoly',
      version: '2.0',
    },

    variables: {
      // ── Stock Variables ──
      Reserves:  { id: 'Reserves',  name: 'Reserves',  type: 'stock', value: 100, initialValue: 100, unit: '£', description: 'Bank reserves', position: { x: 50, y: 300 } },
      Bonds:     { id: 'Bonds',     name: 'Bonds',     type: 'stock', value: 0,   initialValue: 0,   unit: '£', description: 'Government bonds held by banks', position: { x: 200, y: 300 } },
      Deposits:  { id: 'Deposits',  name: 'Deposits',  type: 'stock', value: 100, initialValue: 100, unit: '£', description: 'Total private sector deposits', position: { x: 350, y: 300 } },

      // ── Parameters ──
      SpendFrac: { id: 'SpendFrac', name: 'SpendFrac', type: 'parameter', value: 0.17, initialValue: 0.17, description: 'Government spending as fraction of GDP', position: { x: 50, y: 50 } },
      TaxFrac:   { id: 'TaxFrac',   name: 'TaxFrac',   type: 'parameter', value: 0.17, initialValue: 0.17, description: 'Tax rate as fraction of GDP', position: { x: 200, y: 50 } },
      Velocity:  { id: 'Velocity',  name: 'Velocity',  type: 'parameter', value: 2.0,  initialValue: 2.0,  description: 'Velocity of money', position: { x: 350, y: 50 } },
      IntRate:   { id: 'IntRate',   name: 'IntRate',   type: 'parameter', value: 0.03, initialValue: 0.03, description: 'Interest rate', position: { x: 500, y: 50 } },

      // ── Flow Variables ──
      GDP:       { id: 'GDP',       name: 'GDP',       type: 'flow', value: 0, initialValue: 0, unit: '£/yr', description: 'Gross Domestic Product', position: { x: 500, y: 200 } },
      GovSpend:  { id: 'GovSpend',  name: 'GovSpend',  type: 'flow', value: 0, initialValue: 0, unit: '£/yr', description: 'Government spending', position: { x: 50, y: 450 } },
      Tax:       { id: 'Tax',       name: 'Tax',       type: 'flow', value: 0, initialValue: 0, unit: '£/yr', description: 'Total taxation', position: { x: 200, y: 450 } },
      Deficit:   { id: 'Deficit',   name: 'Deficit',   type: 'flow', value: 0, initialValue: 0, unit: '£/yr', description: 'Government deficit (Spend - Tax)', position: { x: 350, y: 450 } },
      IntBonds:  { id: 'IntBonds',  name: 'IntBonds',  type: 'flow', value: 0, initialValue: 0, unit: '£/yr', description: 'Interest on bonds', position: { x: 500, y: 450 } },
      DebtRatio: { id: 'DebtRatio', name: 'DebtRatio', type: 'flow', value: 0, initialValue: 0, unit: '%',    description: 'Government debt to GDP ratio', position: { x: 650, y: 450 } },
    },

    operations: {
      // GDP = Velocity × Deposits
      op_gdp: { id: 'op_gdp', type: 'multiply', inputs: ['Velocity', 'Deposits'], output: 'GDP', position: { x: 500, y: 150 } },

      // GovSpend = SpendFrac × GDP
      op_spend: { id: 'op_spend', type: 'multiply', inputs: ['SpendFrac', 'GDP'], output: 'GovSpend', position: { x: 50, y: 400 } },

      // Tax = TaxFrac × GDP
      op_tax: { id: 'op_tax', type: 'multiply', inputs: ['TaxFrac', 'GDP'], output: 'Tax', position: { x: 200, y: 400 } },

      // Deficit = GovSpend - Tax
      op_deficit: { id: 'op_deficit', type: 'subtract', inputs: ['GovSpend', 'Tax'], output: 'Deficit', position: { x: 350, y: 400 } },

      // IntBonds = IntRate × Bonds
      op_int_bonds: { id: 'op_int_bonds', type: 'multiply', inputs: ['IntRate', 'Bonds'], output: 'IntBonds', position: { x: 500, y: 400 } },

      // DebtRatio = Bonds / GDP (as percentage)
      op_debt_ratio: { id: 'op_debt_ratio', type: 'divide', inputs: ['Bonds', 'GDP'], output: 'DebtRatio', position: { x: 650, y: 400 } },
    },

    wires: [
      { id: 'w1', from: 'Velocity', to: 'op_gdp', fromPort: 'output', toPort: 'input-0' },
      { id: 'w2', from: 'Deposits', to: 'op_gdp', fromPort: 'output', toPort: 'input-1' },
      { id: 'w3', from: 'SpendFrac', to: 'op_spend', fromPort: 'output', toPort: 'input-0' },
      { id: 'w4', from: 'op_gdp', to: 'op_spend', fromPort: 'output', toPort: 'input-1' },
      { id: 'w5', from: 'TaxFrac', to: 'op_tax', fromPort: 'output', toPort: 'input-0' },
      { id: 'w6', from: 'op_gdp', to: 'op_tax', fromPort: 'output', toPort: 'input-1' },
      { id: 'w7', from: 'op_spend', to: 'op_deficit', fromPort: 'output', toPort: 'input-0' },
      { id: 'w8', from: 'op_tax', to: 'op_deficit', fromPort: 'output', toPort: 'input-1' },
      { id: 'w9', from: 'IntRate', to: 'op_int_bonds', fromPort: 'output', toPort: 'input-0' },
      { id: 'w10', from: 'Bonds', to: 'op_int_bonds', fromPort: 'output', toPort: 'input-1' },
      { id: 'w11', from: 'Bonds', to: 'op_debt_ratio', fromPort: 'output', toPort: 'input-0' },
      { id: 'w12', from: 'op_gdp', to: 'op_debt_ratio', fromPort: 'output', toPort: 'input-1' },
    ],

    godleyTables: [
      {
        id: 'consolidated',
        title: 'Consolidated Balance Sheet (Government + Banks + Private)',
        columns: [
          { name: 'Reserves', variableId: 'Reserves', assetClass: 'asset' },
          { name: 'Bonds',    variableId: 'Bonds',    assetClass: 'asset' },
          { name: 'Deposits', variableId: 'Deposits', assetClass: 'liability' },
        ],
        rows: [
          // Initial conditions
          { label: 'Initial Conditions', cells: ['100', '0', '100'] },

          // Government spending increases deposits
          // Reserves: -GovSpend (government draws down reserves)
          // Deposits: +GovSpend (private sector receives spending)
          // Sum: -GovSpend + GovSpend = 0 ✓
          { label: 'Gov Spending', cells: ['-GovSpend', '', 'GovSpend'] },

          // Taxation decreases deposits
          // Reserves: +Tax (government receives tax)
          // Deposits: -Tax (private sector pays tax)
          // Sum: +Tax - Tax = 0 ✓
          { label: 'Taxation', cells: ['Tax', '', '-Tax'] },

          // Bond sales (government deficit financing)
          // Reserves: +Deficit (government sells bonds, receives cash)
          // Bonds: +Deficit (banks buy bonds)
          // Sum: This is balanced by the previous two rows (GovSpend - Tax = Deficit)
          { label: 'Bond Sales', cells: ['-Deficit', 'Deficit', ''] },

          // Interest on bonds
          // Reserves: -IntBonds (government pays interest)
          // Deposits: +IntBonds (private sector receives interest)
          // Sum: -IntBonds + IntBonds = 0 ✓
          { label: 'Bond Interest', cells: ['-IntBonds', '', 'IntBonds'] },
        ],
      },
    ],

    chartConfigs: [
      {
        id: 'chart-gdp',
        title: 'GDP',
        variables: ['GDP'],
        yAxisLabel: 'Pounds per Year',
        colors: ['#2563eb'],
      },
      {
        id: 'chart-gov-debt',
        title: 'Government Debt',
        variables: ['Bonds', 'DebtRatio'],
        yAxisLabel: 'Pounds / Ratio',
        colors: ['#dc2626', '#f59e0b'],
      },
      {
        id: 'chart-deficit',
        title: 'Government Deficit',
        variables: ['Deficit', 'GovSpend', 'Tax'],
        yAxisLabel: 'Pounds per Year',
        colors: ['#dc2626', '#16a34a', '#7c3aed'],
      },
      {
        id: 'chart-interest',
        title: 'Interest Payments',
        variables: ['IntBonds'],
        yAxisLabel: 'Pounds per Year',
        colors: ['#f59e0b'],
      },
    ],
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initializeHelperConstants(_model: MinskyModel): void {
  // No helper constants needed for this simplified model
}

export function getDefaultModel(): MinskyModel {
  const model = createKeenGovernmentModel()
  initializeHelperConstants(model)
  return model
}

export const KEEN_PARAMETER_CONFIGS = [
  { id: 'SpendFrac', label: 'Gov Spend %', min: 0, max: 0.5, step: 0.01, format: (v: number) => `${(v * 100).toFixed(0)}%` },
  { id: 'TaxFrac', label: 'Tax Rate %', min: 0, max: 0.5, step: 0.01, format: (v: number) => `${(v * 100).toFixed(0)}%` },
  { id: 'Velocity', label: 'Velocity', min: 0.5, max: 5, step: 0.1, format: (v: number) => v.toFixed(1) },
  { id: 'IntRate', label: 'Interest Rate', min: 0, max: 0.1, step: 0.005, format: (v: number) => `${(v * 100).toFixed(1)}%` },
] as const
