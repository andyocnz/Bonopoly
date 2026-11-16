import React from 'react'

export type FinancialTeamRow = {
  teamId: string
  teamName: string
  revenue: number
  revenueUS: number
  revenueAsia: number
  revenueEurope: number
  cogs: number
  materials: number
  labor: number
  logistics: number
  outsourcing: number
  grossProfit: number
  grossMargin: number
  operatingExpenses: number
  rnd: number
  marketing: number
  admin: number
  inventoryHolding?: number
  ebitda: number
  depreciation: number
  ebit: number
  interestExpense: number
  tax: number
  taxLossCarryforward?: number
  netProfit: number
  netMargin: number
  fixedAssets: number
  inventory: number
  receivables: number
  cash: number
  totalAssets: number
  longTermDebt: number
  shortTermLoans: number
  previousShortTermLoans?: number
  payables: number
  totalLiabilities: number
  shareCapital: number
  retainedEarnings: number
  totalEquity: number
  marketShareUS: number
  marketShareAsia: number
  marketShareEurope: number
  unitsSold: number
  unitsSoldUS?: number
  unitsSoldAsia?: number
  unitsSoldEurope?: number
  productionUS?: number
  productionAsia?: number
  outsourceUS?: number
  outsourceAsia?: number
  inventoryStartUnits?: number
  inventoryEndUnits?: number
  inventoryUnitsUS?: number
  inventoryUnitsAsia?: number
  inventoryUnitsEurope?: number
  sharePrice: number
  eps: number
  roe: number
  tsr: number
  dividendYield: number
  sharesOutstanding?: number
  dividends?: number
  sharePriceTrace?: {
    basePrice?: number
    prevSharePrice?: number
    eps?: number
    basePERatio?: number
    growthPremium?: number
    peRatio?: number
    sharePriceBase?: number
    smoothedPrice?: number
    protectedFloor?: number
    finalSharePrice?: number
  } | null
  priceUS?: number
  priceAsia?: number
  priceEurope?: number
  promoUS?: number
  promoAsia?: number
  promoEurope?: number
  features?: number
  csrRating?: number
  trainingBudget?: number
}

type StatementRow = {
  label: string
  get: (team: FinancialTeamRow, prev?: FinancialTeamRow) => number
  fmt: (value: number) => string
  isSection?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
}

type FinancialStatementsProps = {
  teams: FinancialTeamRow[]
  previousTeams?: Map<string, FinancialTeamRow>
  highlightTeamId?: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

const formatUnits = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatPercent = (value: number) => `${value.toFixed(1)}%`
const normalizeShare = (value: number) => (value > 1 ? value / 100 : value)

const renderTable = (
  title: string,
  rows: StatementRow[],
  teams: FinancialTeamRow[],
  previousTeams: Map<string, FinancialTeamRow>,
  highlightTeamId?: string
) => (
  <div className="statement-section">
    <h3>{title}</h3>
    <table className="statement-table">
      <thead>
        <tr>
          <th className="metric-col">Metric</th>
          {teams.map((team) => (
            <th
              key={team.teamId}
              className={`team-col ${team.teamId === highlightTeamId ? 'team-highlight' : ''}`}
            >
              {team.teamName}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.label}
            className={[
              row.isSection ? 'section-row' : '',
              row.isSubtotal ? 'subtotal-row' : '',
              row.isTotal ? 'total-row' : '',
            ].join(' ')}
          >
            <td className="label-cell">{row.label}</td>
            {teams.map((team) => {
              const prev = previousTeams.get(team.teamId)
              const value = row.get(team, prev)
              return (
                <td key={team.teamId} className="value-cell">
                  {row.isSection ? '' : row.fmt(value)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const FinancialStatements: React.FC<FinancialStatementsProps> = ({
  teams,
  previousTeams = new Map<string, FinancialTeamRow>(),
  highlightTeamId,
}) => {
  const pnlRows: StatementRow[] = [
    { label: 'Revenue', get: (t) => t.revenue, fmt: formatCurrency, isSubtotal: true },
    { label: 'COGS', get: (t) => -t.cogs, fmt: (v) => formatCurrency(-v) },
    { label: 'Gross Profit', get: (t) => t.grossProfit, fmt: formatCurrency, isSubtotal: true },
    { label: 'Gross Margin %', get: (t) => t.grossMargin, fmt: formatPercent },
    { label: 'Operating Expenses', get: (t) => -t.operatingExpenses, fmt: (v) => formatCurrency(-v) },
    { label: 'EBITDA', get: (t) => t.ebitda, fmt: formatCurrency, isSubtotal: true },
    { label: 'Depreciation', get: (t) => -t.depreciation, fmt: (v) => formatCurrency(-v) },
    { label: 'EBIT', get: (t) => t.ebit, fmt: formatCurrency, isSubtotal: true },
    { label: 'Interest Expense', get: (t) => -t.interestExpense, fmt: (v) => formatCurrency(-v) },
    { label: 'Tax', get: (t) => -t.tax, fmt: (v) => formatCurrency(-v) },
    { label: 'Tax Loss Carryforward', get: (t) => t.taxLossCarryforward ?? 0, fmt: formatCurrency },
    { label: 'Net Profit', get: (t) => t.netProfit, fmt: formatCurrency },
    { label: 'Dividends Paid', get: (t) => -(t.dividends ?? 0), fmt: (v) => formatCurrency(-v) },
    { label: 'Retained Earnings', get: (t) => (t.netProfit ?? 0) - (t.dividends ?? 0), fmt: formatCurrency, isTotal: true },
    { label: 'Net Margin %', get: (t) => t.netMargin, fmt: formatPercent },
  ]

  const balanceRows: StatementRow[] = [
    { label: 'ASSETS', get: () => 0, fmt: () => '', isSection: true },
    { label: 'Fixed Assets', get: (t) => t.fixedAssets, fmt: formatCurrency },
    { label: 'Inventory', get: (t) => t.inventory, fmt: formatCurrency },
    { label: 'Receivables', get: (t) => t.receivables, fmt: formatCurrency },
    { label: 'Cash', get: (t) => t.cash, fmt: formatCurrency },
    { label: 'Total Assets', get: (t) => t.totalAssets, fmt: formatCurrency, isSubtotal: true },
    { label: 'LIABILITIES', get: () => 0, fmt: () => '', isSection: true },
    { label: 'Long-term Debt', get: (t) => t.longTermDebt, fmt: formatCurrency },
    { label: 'Short-term Loans', get: (t) => t.shortTermLoans, fmt: formatCurrency },
    { label: 'Payables', get: (t) => t.payables, fmt: formatCurrency },
    { label: 'Total Liabilities', get: (t) => t.totalLiabilities, fmt: formatCurrency, isSubtotal: true },
    { label: 'EQUITY', get: () => 0, fmt: () => '', isSection: true },
    { label: 'Share Capital', get: (t) => t.shareCapital, fmt: formatCurrency },
    { label: 'Retained Earnings', get: (t) => t.retainedEarnings, fmt: formatCurrency },
    { label: 'Total Equity', get: (t) => t.totalEquity, fmt: formatCurrency, isTotal: true },
  ]

  const cashflowRows: StatementRow[] = [
    {
      label: 'Operating Cash Flow', get: (t, prev) => {
        const receivablesChange = t.receivables - (prev?.receivables ?? 0)
        const inventoryChange = t.inventory - (prev?.inventory ?? 0)
        const payablesChange = t.payables - (prev?.payables ?? 0)
        return t.ebitda - receivablesChange - inventoryChange + payablesChange - t.interestExpense - t.tax
      }, fmt: formatCurrency, isSubtotal: true
    },
    {
      label: 'Investing Cash Flow', get: (t, prev) => {
        const prevFixed = prev?.fixedAssets ?? 0
        const delta = t.fixedAssets - prevFixed + t.depreciation
        return delta > 0 ? -delta : 0
      }, fmt: formatCurrency, isSubtotal: true
    },
    {
      label: 'Financing Cash Flow', get: (t, prev) => {
        return (t.longTermDebt - (prev?.longTermDebt ?? 0)) +
          (t.shortTermLoans - (prev?.shortTermLoans ?? 0))
      }, fmt: formatCurrency, isSubtotal: true
    },
    {
      label: 'Net Change in Cash', get: (t, prev) => {
        const receivablesChange = t.receivables - (prev?.receivables ?? 0)
        const inventoryChange = t.inventory - (prev?.inventory ?? 0)
        const payablesChange = t.payables - (prev?.payables ?? 0)
        const operating = t.ebitda - receivablesChange - inventoryChange + payablesChange - t.interestExpense - t.tax
        const prevFixed = prev?.fixedAssets ?? 0
        const delta = t.fixedAssets - prevFixed + t.depreciation
        const investing = delta > 0 ? -delta : 0
        const financing =
          (t.longTermDebt - (prev?.longTermDebt ?? 0)) +
          (t.shortTermLoans - (prev?.shortTermLoans ?? 0))
        return operating + investing + financing
      }, fmt: formatCurrency, isTotal: true
    },
  ]

  const kpiRows: StatementRow[] = [
    { label: 'Units Sold', get: (t) => t.unitsSold, fmt: formatUnits },
    {
      label: 'Total Market Share', get: (t) => {
        const shareUS = normalizeShare(t.marketShareUS)
        const shareAsia = normalizeShare(t.marketShareAsia)
        const shareEurope = normalizeShare(t.marketShareEurope)
        if (t.teamId === 'us') return shareUS * 100
        if (t.teamId === 'asia') return shareAsia * 100
        if (t.teamId === 'europe') return shareEurope * 100
        return ((shareUS + shareAsia + shareEurope) / 3) * 100
      }, fmt: formatPercent
    },
    { label: 'Share Price', get: (t) => t.sharePrice, fmt: formatCurrency },
    { label: 'EPS', get: (t) => t.eps, fmt: (v) => formatCurrency(v) },
    { label: 'ROE', get: (t) => t.roe, fmt: formatPercent },
    { label: 'Dividend Yield', get: (t) => t.dividendYield, fmt: formatPercent },
    { label: 'TSR', get: (t) => t.tsr, fmt: formatPercent, isTotal: true },
  ]

  return (
    <div className="financial-statements">
      {renderTable('KPI Summary', kpiRows, teams, previousTeams, highlightTeamId)}
      {renderTable('P&L', pnlRows, teams, previousTeams, highlightTeamId)}
      {renderTable('Balance Sheet', balanceRows, teams, previousTeams, highlightTeamId)}
      {renderTable('Cashflow', cashflowRows, teams, previousTeams, highlightTeamId)}
      <style>{`
        .financial-statements {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .statement-section h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1.05rem;
          color: var(--text-primary);
        }
        .statement-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--bg-card);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        .statement-table th,
        .statement-table td {
          padding: 0.6rem 0.75rem;
          border-bottom: 1px solid var(--border-color);
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .statement-table th.metric-col {
          text-align: left;
          color: var(--text-muted);
          font-weight: 600;
        }
        .statement-table th.team-col {
          text-align: right;
          color: var(--text-primary);
          font-weight: 600;
        }
        .statement-table td.label-cell {
          color: var(--text-primary);
        }
        .statement-table td.value-cell {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .statement-table .section-row td {
          background: var(--bg-overlay);
          color: var(--text-muted);
          font-weight: 700;
        }
        .statement-table .subtotal-row td {
          font-weight: 700;
          color: var(--text-primary);
        }
        .statement-table .total-row td {
          font-weight: 800;
          color: var(--text-accent);
          background: var(--bg-overlay);
        }
        .team-highlight {
          color: var(--text-accent) !important;
        }
      `}</style>
    </div>
  )
}
