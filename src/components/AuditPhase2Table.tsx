import React from 'react'
import { formatCurrency, formatUnits } from '../engine/gameEngine'

interface AuditPhase2TableProps {
  teamRow: Record<string, number | undefined>
  startState: Record<string, number | undefined>
  phaseLabel?: string
}

export const AuditStage3Table: React.FC<AuditPhase2TableProps> = ({ teamRow, startState, phaseLabel }) => {
  if (!teamRow) return <div style={{ color: '#ef4444' }}>No Results Data</div>
  if (!startState) return <div style={{ color: '#ef4444' }}>No Start State Data</div>

  const assets = teamRow.totalAssets || 0
  const lAndE = (teamRow.totalLiabilities || 0) + (teamRow.totalEquity || 0)
  const isBalanced = Math.abs(assets - lAndE) < 1

  const revenue = teamRow.revenue || 0
  const grossProfit = teamRow.grossProfit || 0
  const netProfit = teamRow.netProfit || 0
  const dividendsPaid = teamRow.dividends || 0
  const depreciation = teamRow.depreciation || 0
  const interestExpense = teamRow.interestExpense || 0
  const tax = teamRow.tax || 0

  const inventory = teamRow.inventory || 0
  const startInventory = startState.inventory || 0
  const changeInInventory = inventory - startInventory
  const changeInReceivables = (teamRow.receivables || 0) - (startState.receivables || 0)
  const changeInPayables = (teamRow.payables || 0) - (startState.payables || 0)
  const cashFromOps = netProfit + depreciation - changeInInventory - changeInReceivables + changeInPayables

  const capEx = 0
  const changeInLTDebt = 0
  const changeInShareCapital = 0

  const netChangeInCash = cashFromOps - capEx + changeInLTDebt + changeInShareCapital - dividendsPaid
  const checkCash = (startState.cash || 0) + netChangeInCash
  const cashIsBalanced = Math.abs(checkCash - (teamRow.cash || 0)) < 1

  return (
    <div style={{ fontSize: '0.85rem' }}>
      <div style={{ marginBottom: '1rem', color: '#64748b' }}>
        <span style={{ fontWeight: 700 }}>
          STAGE 3: OPERATIONS{phaseLabel ? ` (${phaseLabel})` : ' (End of R-1)'}
        </span><br />
        Function: <code style={{ color: '#94a3b8' }}>calculateRoundMinus1()</code><br />
        Action: Run Ops &gt; <span style={{ color: '#94a3b8' }}>Sales = Production / 1.1 (~10% End Inv)</span>
      </div>
      <div style={{ marginBottom: '1.5rem', color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          STAGE 3: INCOME STATEMENT
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sales Revenue:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(revenue)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>COGS:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(teamRow.cogs || 0)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px', paddingTop: '2px' }}>
          <span>Gross Profit:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(grossProfit)}</span>
        </div>
        <div style={{ marginTop: '0.5rem', paddingLeft: '0.5rem', borderLeft: '2px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Admin:</span>
            <span>({formatCurrency(teamRow.admin || 0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>R&amp;D:</span>
            <span>({formatCurrency(teamRow.rnd || 0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Marketing:</span>
            <span>({formatCurrency(teamRow.marketing || 0)})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888' }}>
            <span>Depreciation:</span>
            <span>({formatCurrency(depreciation)})</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px' }}>
          <span>EBIT:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(teamRow.ebit || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Interest:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(interestExpense)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tax:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(tax)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #333' }}>
          <span style={{ fontWeight: 700 }}>Net Profit:</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(netProfit)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span>Dividends Paid:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(dividendsPaid)})</span>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          BALANCE SHEET
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>ASSETS</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cash:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.cash || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Receivables:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.receivables || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Inventory:</span>
            <span style={{ color: '#fff' }} title={`${formatUnits(teamRow.inventoryUnits || 0)} units`}>
              {formatCurrency(inventory)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fixed Assets:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.fixedAssets || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
            <span style={{ fontWeight: 600 }}>Total Assets:</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>
              {formatCurrency((teamRow.cash || 0) + (teamRow.receivables || 0) + inventory + (teamRow.fixedAssets || 0))}
            </span>
          </div>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>LIABILITIES</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Payables:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.payables || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Short-Term Debt:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.shortTermLoans || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Long-Term Debt:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.longTermDebt || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
            <span style={{ fontWeight: 600 }}>Total Liabilities:</span>
            <span style={{ color: '#ccc', fontWeight: 600 }}>{formatCurrency(teamRow.totalLiabilities || 0)}</span>
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>EQUITY</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Share Capital:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.shareCapital || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Retained Earnings:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(teamRow.retainedEarnings || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '2px' }}>
            <span style={{ fontWeight: 600 }}>Total Equity:</span>
            <span style={{ color: '#ccc', fontWeight: 600 }}>{formatCurrency(teamRow.totalEquity || 0)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
          <span style={{ fontWeight: 700 }}>CHECK (L+E):</span>
          <span style={{ fontWeight: 700, color: isBalanced ? '#10b981' : '#ef4444' }}>
            {formatCurrency(lAndE)} {isBalanced ? 'OK' : 'FAIL'}
          </span>
        </div>
      </div>

      <div style={{ color: '#ccc' }}>
        <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#fbbf24', fontWeight: 600 }}>
          CASHFLOW STATEMENT
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Net Profit:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(netProfit)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>+ Depreciation:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(depreciation)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.75rem' }}>
          <span>(Cash from P&amp;L):</span>
          <span>{formatCurrency(netProfit + depreciation)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span>- Change in Inventory:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(changeInInventory)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>- Change in Receivables:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(changeInReceivables)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>+ Change in Payables:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(changeInPayables)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '8px', paddingTop: '4px' }}>
          <span style={{ fontWeight: 700 }}>Cash from Operations:</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(cashFromOps)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span>- CapEx:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(capEx)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>+ Change in Debt/Equity:</span>
          <span style={{ color: '#fff' }}>{formatCurrency(changeInLTDebt + changeInShareCapital)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>- Dividends Paid:</span>
          <span style={{ color: '#fff' }}>({formatCurrency(dividendsPaid)})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', marginTop: '8px', paddingTop: '4px' }}>
          <span style={{ fontWeight: 700 }}>NET CHANGE IN CASH:</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(netChangeInCash)}</span>
        </div>
        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #333', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Starting Cash (from Phase 1):</span>
            <span style={{ color: '#fff' }}>{formatCurrency(startState.cash || 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>+ Net Change in Cash:</span>
            <span style={{ color: '#fff' }}>{formatCurrency(netChangeInCash)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontWeight: 700 }}>CHECK (ENDING CASH):</span>
            <span style={{ fontWeight: 700, color: cashIsBalanced ? '#10b981' : '#ef4444' }}>
              {formatCurrency(teamRow.cash || 0)} {cashIsBalanced ? 'OK' : 'FAIL'}
            </span>
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.7rem' }}>
          * CapEx/Debt set to $0 for R-1<br />
          * Net Change in Cash must reconcile BS Cash
        </div>
      </div>
    </div>
  )
}
