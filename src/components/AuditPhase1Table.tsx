import React from 'react'
import { formatCurrency } from '../engine/gameEngine'

interface AuditPhase1TableProps {
  startState: Record<string, unknown> | null
  phaseLabel?: string
}

export const AuditStage2Table: React.FC<AuditPhase1TableProps> = ({ startState, phaseLabel }) => {
  if (!startState) return <div style={{ color: '#ef4444' }}>No Start State Data</div>
  const num = (value: unknown) => (typeof value === 'number' ? value : 0)

    const lAndE = num(startState.totalLiabilities) + num(startState.totalEquity)
    const totalAssets = num(startState.totalAssets)
    const isBalanced = Math.abs(totalAssets - lAndE) < 1
    const componentSum =
        num(startState.cash) +
        num(startState.receivables) +
        num(startState.inventory) +
        num(startState.fixedAssets)
    const componentDelta = componentSum - totalAssets

  return (
    <>
      <div style={{ marginBottom: '1.5rem', color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          STAGE 2: CAPITALIZATION{phaseLabel ? ` (${phaseLabel})` : ' (Day 0)'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sales Revenue:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>COGS:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(0)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px', paddingTop: '2px' }}>
          <span>Gross Profit:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
        </div>
        <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Admin:</span>
            <span>({formatCurrency(0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>R&amp;D:</span>
            <span>({formatCurrency(0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Marketing:</span>
            <span>({formatCurrency(0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Depreciation:</span>
            <span>({formatCurrency(0)})</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px' }}>
          <span>EBIT:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Interest:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(0)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tax:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(0)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #333' }}>
          <span style={{ fontWeight: 700 }}>Net Profit:</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(0)}</span>
        </div>
      </div>

      <div style={{ color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          BALANCE SHEET
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>ASSETS</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: '#fbbf24' }}>[Assumption]</span> Cash:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.cash))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Receivables:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.receivables))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Inventory:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.inventory))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: '#fbbf24' }}>[Assumption]</span> Fixed Assets:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.fixedAssets))}</span>
          </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
          <span style={{ fontWeight: 600 }}>Total Assets:</span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(totalAssets)}</span>
        </div>
        {Math.abs(componentDelta) >= 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#fbbf24', fontSize: '0.7rem' }}>
            <span>Components Sum (computed):</span>
            <span>{formatCurrency(componentSum)} (Δ {formatCurrency(componentDelta)})</span>
          </div>
        )}
        {Math.abs(componentDelta) >= 1 && (
          <details style={{ marginTop: '6px', color: '#94a3b8', fontSize: '0.7rem' }}>
            <summary style={{ cursor: 'pointer' }}>Raw startState</summary>
            <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(startState, null, 2)}
            </pre>
          </details>
        )}
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>LIABILITIES</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Payables:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.payables))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Short-Term Debt:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.shortTermLoans))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: '#fbbf24' }}>[Assumption]</span> Long-Term Debt:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.longTermDebt))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
            <span style={{ fontWeight: 600 }}>Total Liabilities:</span>
            <span style={{ color: '#ccc', fontWeight: 600 }}>{formatCurrency(num(startState.totalLiabilities))}</span>
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>EQUITY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: '#a78bfa' }}>[Balancer]</span> Share Capital:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.shareCapital))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Retained Earnings:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(num(startState.retainedEarnings))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
            <span style={{ fontWeight: 600 }}>Total Equity:</span>
            <span style={{ color: '#ccc', fontWeight: 600 }}>{formatCurrency(num(startState.totalEquity))}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
          <span style={{ fontWeight: 700 }}>CHECK (L+E):</span>
          <span style={{ fontWeight: 700, color: isBalanced ? '#10b981' : '#ef4444' }}>
            {formatCurrency(lAndE)} {isBalanced ? 'OK' : 'FAIL'}
          </span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          CASHFLOW STATEMENT{phaseLabel ? ` (${phaseLabel})` : ' (Day 0)'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>+ New Long-Term Debt:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(num(startState.longTermDebt))}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>+ Share Capital Issue:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(num(startState.shareCapital))}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.75rem' }}>
          <span>(Cash from Financing):</span>
          <span>{formatCurrency(num(startState.longTermDebt) + num(startState.shareCapital))}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span>- Purchase of Fixed Assets:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(num(startState.fixedAssets))})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.75rem' }}>
          <span>(Cash from Investing):</span>
          <span>({formatCurrency(num(startState.fixedAssets))})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', marginTop: '8px', paddingTop: '4px' }}>
          <span style={{ fontWeight: 700 }}>NET CHANGE IN CASH:</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(num(startState.cash))}</span>
        </div>
      </div>
      <div style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.7rem' }}>
        * P&amp;L: None (No ops yet)<br />
        * Assumption: Debt, Cash, Plants<br />
        * Balancer: Equity is derived
      </div>
    </>
  )
}
