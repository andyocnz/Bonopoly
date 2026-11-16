// ── Validation Panel ──
// Shows real-time sanity checks so non-economists can verify correctness.

import { useMemo } from 'react'
import type { MinskyModel, SimulationState } from '../../types/minsky'
import { getVariableValue, validateGodleyTable } from '../../engine/minskyEngine'

interface ValidationPanelProps {
  model: MinskyModel
  state: SimulationState
  allValues: Map<string, number>
}

interface Check {
  label: string
  expected: string
  actual: string
  pass: boolean
  explanation: string
}

export function ValidationPanel({ model, state, allValues }: ValidationPanelProps) {
  const checks = useMemo(() => {
    const results: Check[] = []
    const v = (id: string) => getVariableValue(id, model, state)

    // ── 1. GDP identity: GDP = Velocity × Deposits ──
    const velocity = v('Velocity')
    const deposits = v('Deposits')
    const expectedGDP = velocity * deposits
    const actualGDP = v('GDP')
    results.push({
      label: 'GDP = Velocity × Deposits',
      expected: `${velocity.toFixed(2)} × ${deposits.toFixed(2)} = ${expectedGDP.toFixed(2)}`,
      actual: actualGDP.toFixed(2),
      pass: Math.abs(expectedGDP - actualGDP) < 1,
      explanation: 'GDP should equal Velocity times total deposits',
    })

    // ── 2. Government spending identity: GovSpend = SpendFrac × GDP ──
    const spendFrac = v('SpendFrac')
    const expectedSpend = spendFrac * actualGDP
    const actualSpend = v('GovSpend')
    results.push({
      label: 'GovSpend = SpendFrac × GDP',
      expected: `${spendFrac.toFixed(2)} × ${actualGDP.toFixed(2)} = ${expectedSpend.toFixed(2)}`,
      actual: actualSpend.toFixed(2),
      pass: Math.abs(expectedSpend - actualSpend) < 1,
      explanation: 'Government spending should be the spending fraction times GDP',
    })

    // ── 3. Tax identity: Tax = TaxFrac × GDP ──
    const taxFrac = v('TaxFrac')
    const expectedTax = taxFrac * actualGDP
    const actualTax = v('Tax')
    results.push({
      label: 'Tax = TaxFrac × GDP',
      expected: `${taxFrac.toFixed(2)} × ${actualGDP.toFixed(2)} = ${expectedTax.toFixed(2)}`,
      actual: actualTax.toFixed(2),
      pass: Math.abs(expectedTax - actualTax) < 1,
      explanation: 'Total taxation should be the tax fraction times GDP',
    })

    // ── 4. Deficit = GovSpend - Tax ──
    const expectedDeficit = actualSpend - actualTax
    const deficit = v('Deficit')
    results.push({
      label: 'Deficit = GovSpend - Tax',
      expected: `${actualSpend.toFixed(2)} - ${actualTax.toFixed(2)} = ${expectedDeficit.toFixed(2)}`,
      actual: deficit.toFixed(2),
      pass: Math.abs(expectedDeficit - deficit) < 1,
      explanation: 'Government deficit is spending minus tax revenue',
    })

    // ── 5. Interest on Bonds = IntRate × Bonds ──
    const intRate = v('IntRate')
    const bonds = v('Bonds')
    const expectedIntBonds = intRate * bonds
    const actualIntBonds = v('IntBonds')
    results.push({
      label: 'IntBonds = IntRate × Bonds',
      expected: `${intRate.toFixed(3)} × ${bonds.toFixed(2)} = ${expectedIntBonds.toFixed(2)}`,
      actual: actualIntBonds.toFixed(2),
      pass: Math.abs(expectedIntBonds - actualIntBonds) < 0.5,
      explanation: 'Interest on government bonds should be interest rate times total bonds',
    })

    // ── 6. Debt ratio = Bonds / GDP ──
    const expectedDebtRatio = bonds / (actualGDP || 1)
    const debtRatio = v('DebtRatio')
    results.push({
      label: 'DebtRatio = Bonds / GDP',
      expected: `${bonds.toFixed(2)} / ${actualGDP.toFixed(2)} = ${expectedDebtRatio.toFixed(4)}`,
      actual: debtRatio.toFixed(4),
      pass: Math.abs(expectedDebtRatio - debtRatio) < 0.01,
      explanation: 'Debt-to-GDP ratio is government bonds divided by GDP',
    })

    // ── 7. Godley table double-entry: all rows sum to zero ──
    for (const table of model.godleyTables) {
      const validation = validateGodleyTable(table, allValues)
      const allRowsValid = validation.slice(1).every(r => r.valid) // skip initial conditions
      results.push({
        label: `${table.title}: Double-entry balanced`,
        expected: 'All flow rows sum to 0',
        actual: allRowsValid ? 'All balanced' : `${validation.filter(r => !r.valid).length} rows unbalanced`,
        pass: allRowsValid,
        explanation: 'Every Godley table row must sum to zero (every debit has a matching credit)',
      })
    }

    // ── 8. Stocks are non-negative (basic sanity) ──
    const reserves = v('Reserves')
    results.push({
      label: 'Stocks non-negative',
      expected: 'All ≥ 0',
      actual: `Reserves=${reserves.toFixed(1)}, Deposits=${deposits.toFixed(1)}, Bonds=${bonds.toFixed(1)}`,
      pass: reserves >= -1 && deposits >= -1 && bonds >= -1,
      explanation: 'Stock variables should generally stay non-negative in a stable model',
    })

    // ── 9. GDP should be positive ──
    results.push({
      label: 'GDP is positive',
      expected: '> 0',
      actual: actualGDP.toFixed(2),
      pass: actualGDP > 0,
      explanation: 'GDP should always be positive in a functioning economy',
    })

    return results
  }, [model, state, allValues])

  const passCount = checks.filter(c => c.pass).length
  const totalCount = checks.length
  const allPass = passCount === totalCount

  return (
    <div className="minsky-validation-panel">
      <div className="minsky-validation-header">
        <h4 className="minsky-validation-title">Sanity Checks</h4>
        <span className={`minsky-validation-badge ${allPass ? 'pass' : 'warn'}`}>
          {passCount}/{totalCount} passing
        </span>
      </div>
      <div className="minsky-validation-checks">
        {checks.map((check, i) => (
          <div key={i} className={`minsky-check ${check.pass ? 'pass' : 'fail'}`}>
            <div className="minsky-check-header">
              <span className="minsky-check-icon">{check.pass ? '\u2713' : '\u2717'}</span>
              <span className="minsky-check-label">{check.label}</span>
            </div>
            <div className="minsky-check-detail">
              <div className="minsky-check-expected">
                <span className="minsky-check-key">Expected:</span> {check.expected}
              </div>
              <div className="minsky-check-actual">
                <span className="minsky-check-key">Actual:</span> {check.actual}
              </div>
            </div>
            <div className="minsky-check-explanation">{check.explanation}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
