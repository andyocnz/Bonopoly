import React, { useMemo, useState } from 'react'
import type { FinancialTeamRow } from './FinancialStatements'
import { DEFAULT_REGION_LABELS } from '../utils/regionLabels'
import { calculateCashflowStatement, type CashflowStatementInputs } from '../utils/financialCashflow'
import type { GameConfig } from '../engine/gameEngine'

type FinancialReportProps = {
  title?: string
  subtitle?: string
  asOf?: string
  teams: FinancialTeamRow[]
  previousTeams?: Map<string, FinancialTeamRow>
  exportRounds?: {
    roundNumber: number
    label?: string
    teams: FinancialTeamRow[]
    previousTeams?: Map<string, FinancialTeamRow>
    taxRate?: number
    interestRate?: number
    inventoryHoldingRate?: number
  }[]
  emphasis?: 'default' | 'bold'
  highlightTeamId?: string
  allowSummaryBreakdown?: boolean
  regionLabels?: { us: string; asia: string; europe: string }
  compactNumbers?: boolean
  // New props for integrated controls
  onRoundChange?: (round: number) => void
  currentRound?: number
  availableRounds?: { roundNumber: number; label: string }[]
  onPrecisionToggle?: () => void
  startingBalanceSheet?: {
    cash: number
    receivables?: number
    inventory?: number
    payables?: number
    fixedAssets: number
    longTermDebt: number
    shortTermLoans?: number
    shareCapital: number
    retainedEarnings?: number
  }
  theme?: 'default' | 'pro'
  colorMode?: 'light' | 'dark'
  industryConfig?: GameConfig
}

type ExportRound = NonNullable<FinancialReportProps['exportRounds']>[number]

type TabKey = 'summary' | 'balance' | 'pnl' | 'cashflow'

const formatCurrency = (value: number, compact = false) => {
  if (compact) {
    const abs = Math.abs(value)
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (abs >= 1000) return `$${(value / 1000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCurrencyPrecise = (value: number, compact = false) => {
  if (compact) {
    const abs = Math.abs(value)
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (abs >= 1000) return `$${(value / 1000).toFixed(2)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatSignedCurrency = (value: number, compact = false) => {
  const abs = Math.abs(value)
  const formatted = formatCurrency(abs, compact)
  return value < 0 ? `(${formatted})` : formatted
}

const formatUnits = (value: number, compact = false) => {
  if (compact && Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`
const normalizeShare = (value: number) => (value > 1 ? value / 100 : value)

const formatMaybeCurrency = (value?: number | null, compact = false) => (
  Number.isFinite(value) ? formatCurrency(value as number, compact) : '-'
)

const formatMaybePercent = (value?: number | null) => (
  Number.isFinite(value) ? `${(value as number).toFixed(1)}%` : '-'
)

const formatMaybeNumber = (value?: number | null, digits = 0) => (
  Number.isFinite(value) ? (value as number).toFixed(digits) : '-'
)

const getPrev = (prev?: Map<string, FinancialTeamRow>, teamId?: string) =>
  teamId && prev ? prev.get(teamId) : undefined

export const FinancialReport: React.FC<FinancialReportProps> = ({
  title = 'AIgopoly Financial Report',
  subtitle,
  asOf,
  teams,
  previousTeams = new Map<string, FinancialTeamRow>(),
  emphasis = 'default',
  highlightTeamId,
  allowSummaryBreakdown = true,
  regionLabels,
  compactNumbers = false,
  onRoundChange,
  currentRound,
  availableRounds,
  onPrecisionToggle,
  startingBalanceSheet,
  exportRounds,
  theme = 'pro',
  colorMode,
  industryConfig,
}) => {
  const labels = regionLabels ?? DEFAULT_REGION_LABELS
  const getTeamDisplayName = (team: FinancialTeamRow) => {
    const id = team.teamId.toLowerCase()
    if (id === 'us') return labels.us
    if (id === 'asia') return labels.asia
    if (id === 'europe' || id === 'eu') return labels.europe
    return team.teamName
  }
  const [activeTab, setActiveTab] = useState<TabKey>('balance')
  const [showAdvancedSummary, setShowAdvancedSummary] = useState(false)
  const canShowSummaryBreakdown = allowSummaryBreakdown && teams.length > 1
  const orderedTeams = useMemo(
    () => [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    [teams]
  )
  const hasRegionRows = teams.some((team) => team.teamId === 'us' || team.teamId === 'asia' || team.teamId === 'europe')
  const kpiTeams = hasRegionRows
    ? teams.filter((team) => team.teamId === 'total')
    : orderedTeams
  const buildBaselinePrevMap = (teams: FinancialTeamRow[]) => {
    if (!startingBalanceSheet) return new Map<string, FinancialTeamRow>()
    const map = new Map<string, FinancialTeamRow>()
    teams.forEach((team) => {
      const cash = startingBalanceSheet.cash
      const receivables = startingBalanceSheet.receivables ?? 0
      const inventory = startingBalanceSheet.inventory ?? 0
      const fixedAssets = startingBalanceSheet.fixedAssets
      const payables = startingBalanceSheet.payables ?? 0
      const shortTermLoans = startingBalanceSheet.shortTermLoans ?? 0
      const longTermDebt = startingBalanceSheet.longTermDebt
      const shareCapital = startingBalanceSheet.shareCapital
      const retainedEarnings = startingBalanceSheet.retainedEarnings ?? 0
      const totalAssets = cash + receivables + inventory + fixedAssets
      const totalLiabilities = longTermDebt + shortTermLoans + payables
      const totalEquity = shareCapital + retainedEarnings
      map.set(team.teamId, {
        ...team,
        cash,
        receivables,
        inventory,
        fixedAssets,
        payables,
        shortTermLoans,
        longTermDebt,
        shareCapital,
        retainedEarnings,
        totalAssets,
        totalLiabilities,
        totalEquity,
      })
    })
    return map
  }

  const buildPreviousTeamsEffective = (
    teams: FinancialTeamRow[],
    prevTeams: Map<string, FinancialTeamRow>,
    roundNumber?: number
  ) => {
    if (!startingBalanceSheet) return prevTeams
    if (!teams.length) return prevTeams
    const hasPrev = prevTeams && prevTeams.size > 0
    if (hasPrev) return prevTeams
    const needsBaselinePrev = roundNumber === -1 || roundNumber === 0 || roundNumber === 1
    if (!needsBaselinePrev) return prevTeams
    return buildBaselinePrevMap(teams)
  }

  const previousTeamsEffective = buildPreviousTeamsEffective(orderedTeams, previousTeams, currentRound)

  const handleExportCSV = () => {
    const roundsForExport = (exportRounds && exportRounds.length)
      ? exportRounds
      : [{
        roundNumber: typeof currentRound === 'number' ? currentRound : 0,
        label: asOf || 'Latest',
        teams: orderedTeams,
        previousTeams,
      }]

    const roundsToExport = roundsForExport
      .filter((round) => typeof currentRound !== 'number' || round.roundNumber <= currentRound)
      .sort((a, b) => a.roundNumber - b.roundNumber)

    const highlightTeam = orderedTeams.find(t => t.teamId === highlightTeamId)
    const highlightTeamName = highlightTeam ? getTeamDisplayName(highlightTeam) : 'Team'
    const csvRows: string[][] = []

    // 1. Report Header
    csvRows.push([`FINANCIAL INTELLIGENCE AUDIT REPORT`])
    csvRows.push([`TEAM: ${highlightTeamName.toUpperCase()}`])
    csvRows.push([`EXPORTED AT: ${new Date().toLocaleString()}`])
    csvRows.push([])

    // 3. Pivoted Data Rows
    // Helper to extract data across all rounds for a specific metric
    const addPivotedRow = (
      label: string,
      getValue: (playerTeam: FinancialTeamRow, prev: FinancialTeamRow | undefined, round: ExportRound) => number | string
    ) => {
      const row = [label]
      roundsToExport.forEach(round => {
        const playerTeam = round.teams.find(t => t.teamId === highlightTeamId) || round.teams[0]
        if (!playerTeam) {
          row.push('N/A')
          return
        }

        // Fetch prev round data
        const targetPrevRoundNum = (round.roundNumber === 1) ? -1 : round.roundNumber - 1
        const prevRoundFromList = roundsToExport.find(r => r.roundNumber === targetPrevRoundNum)
        let prev = prevRoundFromList?.teams.find(t => t.teamId === playerTeam.teamId)

        if (!prev && round.roundNumber !== -1) {
          const prevTeamsEffective = buildPreviousTeamsEffective(
            round.teams,
            round.previousTeams ?? new Map<string, FinancialTeamRow>(),
            round.roundNumber
          )
          prev = getPrev(prevTeamsEffective, playerTeam.teamId)
        }

        const val = getValue(playerTeam, prev, round)
        row.push(typeof val === 'number' ? String(val) : String(val ?? '0'))
      })
      csvRows.push(row)
    }

    // Define Header Row
    const headerRow = ['Line Item', ...roundsToExport.map(r => r.label ?? `Round ${r.roundNumber}`)]
    csvRows.push(headerRow)

    // --- P&L Section ---
    csvRows.push(['INCOME STATEMENT'])
    addPivotedRow('Sales Revenue', (t) => t.revenue)
    addPivotedRow('COGS', (t) => -t.cogs)
    addPivotedRow('  - Materials', (t) => -t.materials)
    addPivotedRow('  - Labor', (t) => -t.labor)
    addPivotedRow('  - Transport & Tariffs', (t) => -t.logistics)
    addPivotedRow('  - Outsourcing', (t) => -t.outsourcing)
    addPivotedRow('GROSS PROFIT', (t) => t.grossProfit ?? (t.revenue - t.cogs))
    addPivotedRow('Admin (SG&A)', (t) => -t.admin)
    addPivotedRow('R&D', (t) => -t.rnd)
    addPivotedRow('Marketing', (t) => -t.marketing)
    addPivotedRow('Inventory Holding Cost', (t) => -(t.inventoryHolding ?? 0))
    addPivotedRow('Depreciation', (t) => -t.depreciation)
    addPivotedRow('EBIT', (t) => t.ebit)
    addPivotedRow('Interest Expense', (t) => -t.interestExpense)
    addPivotedRow('Tax Provision', (t) => -t.tax)
    addPivotedRow('NET PROFIT', (t) => t.netProfit)
    addPivotedRow('Dividends Paid', (t) => -(t.dividends ?? 0))
    addPivotedRow('Retained Earnings (Addition)', (t) => (t.netProfit ?? 0) - (t.dividends ?? 0))
    csvRows.push([])

    // --- Balance Sheet Section ---
    csvRows.push(['BALANCE SHEET (End of Period)'])
    csvRows.push(['ASSETS'])
    addPivotedRow('  Cash', (t) => t.cash)
    addPivotedRow('  Receivables', (t) => t.receivables)
    addPivotedRow('  Inventory', (t) => t.inventory)
    addPivotedRow('  Fixed Assets (PP&E)', (t) => t.fixedAssets)
    addPivotedRow('TOTAL ASSETS', (t) => t.totalAssets || (t.cash + t.receivables + t.inventory + t.fixedAssets))

    csvRows.push(['LIABILITIES'])
    addPivotedRow('  Payables', (t) => t.payables)
    addPivotedRow('  Short-Term Debt', (t) => t.shortTermLoans ?? 0)
    addPivotedRow('  Long-Term Debt', (t) => t.longTermDebt)
    addPivotedRow('TOTAL LIABILITIES', (t) => (t.payables ?? 0) + (t.shortTermLoans ?? 0) + (t.longTermDebt ?? 0))

    csvRows.push(['EQUITY'])
    addPivotedRow('  Share Capital', (t) => t.shareCapital)
    addPivotedRow('  Retained Earnings (Closing Balance)', (t) => t.retainedEarnings)
    addPivotedRow('TOTAL EQUITY', (t) => (t.shareCapital ?? 0) + (t.retainedEarnings ?? 0))
    addPivotedRow('TOTAL LIABILITIES & EQUITY', (t) => (t.totalLiabilities ?? 0) + (t.totalEquity ?? 0))
    csvRows.push([])

    // --- Cash Flow Section ---
    csvRows.push(['CASH FLOW STATEMENT'])
    const getCF = (t: FinancialTeamRow, prev?: FinancialTeamRow) =>
      calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined)

    addPivotedRow('Net Profit', (t, p) => getCF(t, p).netProfit)
    addPivotedRow('  - Add Back Depreciation', (t, p) => getCF(t, p).depreciation)
    addPivotedRow('  - Change in Inventory', (t, p) => getCF(t, p).changeInInventory)
    addPivotedRow('  - Change in Receivables', (t, p) => getCF(t, p).changeInReceivables)
    addPivotedRow('  - Change in Payables', (t, p) => getCF(t, p).changeInPayables)
    addPivotedRow('CASH FROM OPERATIONS', (t, p) => getCF(t, p).cashFromOperations)
    addPivotedRow('Capital Expenditures (CapEx)', (t, p) => getCF(t, p).capex)
    addPivotedRow('Change in Long-Term Debt', (t, p) => getCF(t, p).changeInLongTermDebt)
    addPivotedRow('Change in Short-Term Debt', (t, p) => getCF(t, p).changeInShortTermDebt)
    addPivotedRow('Change in Equity', (t, p) => getCF(t, p).changeInEquity)
    addPivotedRow('Dividends Paid', (t, p) => getCF(t, p).dividendsPaid)
    addPivotedRow('NET CHANGE IN CASH', (t, p) => getCF(t, p).netChange)
    addPivotedRow('Starting Cash Position', (t, p) => getCF(t, p).startingCash)
    addPivotedRow('CLOSING CASH POSITION', (t) => t.cash)
    csvRows.push([])

    // 4. Disclaimer
    csvRows.push(['--- AUDIT DISCLAIMER ---'])
    csvRows.push(['AIgopoly by AI Decision Lab is an educational business simulation.'])
    csvRows.push(['All data, company names, and market outcomes generated by this simulation are entirely fictional.'])
    csvRows.push(['They are intended for management training and academic purposes only.'])
    csvRows.push([])

    const BOM = '\uFEFF'
    const csvContent = BOM + csvRows.map(row => row.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.setAttribute('download', `${title || 'Financial_Report'}_${highlightTeamName.replace(/\s+/g, '_')}_${timestamp}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyTeamTable = (teamId: string, section: 'highlights' | 'kpi' | 'shareprice' | 'pnl' | 'balance' | 'cashflow') => {
    const team = orderedTeams.find((t) => t.teamId === teamId)
    if (!team) return

    const prevTeamsEffective = buildPreviousTeamsEffective(orderedTeams, previousTeams, currentRound)
    const prev = getPrev(prevTeamsEffective, team.teamId)

    const rows: [string, string][] = []
    rows.push(['Line Item', getTeamDisplayName(team)])

    // Formatters
    const fmt = (val: number | undefined) => formatCurrency(val ?? 0)
    const fmtSigned = (val: number | undefined) => formatSignedCurrency(val ?? 0)
    const fmtPct = (val: number | undefined) => formatPercent(val ?? 0)
    const fmtUnits = (val: number | undefined) => formatUnits(val ?? 0)
    const fmtPrecise = (val: number | undefined) => formatCurrencyPrecise(val ?? 0)

    if (section === 'highlights') {
      rows.push(['Total Revenue', fmt(team.revenue)])
      rows.push(['Net Profit', fmt(team.netProfit)])
      rows.push(['Dividends Paid', fmt(team.dividends)])
      rows.push(['Net Margin', fmtPct(team.netMargin)])
      rows.push(['Units Sold', fmtUnits(team.unitsSold)])
    } else if (section === 'kpi') {
      const totalAssets = team.totalAssets || (team.cash + team.receivables + team.inventory + team.fixedAssets)
      const totalLiabilities = team.totalLiabilities || (team.payables + (team.shortTermLoans ?? 0) + team.longTermDebt)
      const totalEquity = team.totalEquity || (team.shareCapital + team.retainedEarnings)
      const currentAssets = team.cash + team.receivables + team.inventory
      const currentLiabilities = team.payables + (team.shortTermLoans ?? 0)

      const roa = totalAssets ? team.netProfit / totalAssets : 0
      const roe = totalEquity ? team.netProfit / totalEquity : 0
      const debtToEquity = totalEquity ? totalLiabilities / totalEquity : 0
      const currentRatio = currentLiabilities ? currentAssets / currentLiabilities : 0

      rows.push(['ROE', fmtPct(roe)])
      rows.push(['ROA', fmtPct(roa)])
      rows.push(['Debt-to-Equity', fmtPct(debtToEquity)])
      rows.push(['Current Ratio', fmt(currentRatio)])
    } else if (section === 'shareprice') {
      const marketCap = team.sharePrice * (team.sharesOutstanding ?? 0)
      rows.push(['Share Price', fmtPrecise(team.sharePrice)])
      rows.push(['Shares Outstanding', fmtUnits(team.sharesOutstanding)])
      rows.push(['Market Cap', fmt(marketCap)])
      rows.push(['EPS', fmtPrecise(team.eps)])
      rows.push(['Dividend Yield', fmtPct(team.dividendYield)])
      rows.push(['TSR', fmtPct(team.tsr)])
    } else if (section === 'pnl') {
      rows.push(['Sales Revenue', fmt(team.revenue)])
      rows.push(['COGS', fmtSigned(team.cogs)])
      rows.push(['Gross Profit', fmt(team.grossProfit ?? (team.revenue - team.cogs))])
      rows.push(['Admin', fmtSigned(team.admin)])
      rows.push(['R&D', fmtSigned(team.rnd)])
      rows.push(['Marketing', fmtSigned(team.marketing)])
      rows.push(['Inventory Holding', fmtSigned(team.inventoryHolding ?? 0)])
      rows.push(['Depreciation', fmtSigned(team.depreciation)])
      rows.push(['EBIT', fmt(team.ebit)])
      rows.push(['Interest', fmtSigned(team.interestExpense)])
      rows.push(['Tax', fmtSigned(team.tax)])
      rows.push(['Net Profit', fmt(team.netProfit)])
      rows.push(['Dividends Paid', fmtSigned(-(team.dividends ?? 0))])
      rows.push(['Retained Earnings', fmt((team.netProfit ?? 0) - (team.dividends ?? 0))])
    } else if (section === 'balance') {
      rows.push(['ASSETS', ''])
      rows.push(['Cash', fmt(team.cash)])
      rows.push(['Receivables', fmt(team.receivables)])
      rows.push(['Inventory', fmt(team.inventory)])
      rows.push(['Fixed Assets', fmt(team.fixedAssets)])
      rows.push(['Total Assets', fmt(team.totalAssets || (team.cash + team.receivables + team.inventory + team.fixedAssets))])
      rows.push(['LIABILITIES', ''])
      rows.push(['Payables', fmt(team.payables)])
      rows.push(['Short-Term Debt', fmt(team.shortTermLoans)])
      rows.push(['Long-Term Debt', fmt(team.longTermDebt)])
      rows.push(['Total Liabilities', fmt(team.totalLiabilities || (team.payables + (team.shortTermLoans ?? 0) + team.longTermDebt))])
      rows.push(['EQUITY', ''])
      rows.push(['Share Capital', fmt(team.shareCapital)])
      rows.push(['Retained Earnings', fmt(team.retainedEarnings)])
      rows.push(['Total Equity', fmt(team.totalEquity || (team.shareCapital + team.retainedEarnings))])
    } else if (section === 'cashflow') {
      const cf = calculateCashflowStatement(toCashflowInputs(team), prev ? toCashflowInputs(prev) : undefined)
      rows.push(['Net Profit', fmt(cf.netProfit)])
      rows.push(['Depreciation', fmt(cf.depreciation)])
      rows.push(['Change in Inventory', fmtSigned(cf.changeInInventory)])
      rows.push(['Change in Receivables', fmtSigned(cf.changeInReceivables)])
      rows.push(['Change in Payables', fmtSigned(cf.changeInPayables)])
      rows.push(['Cash from Operations', fmt(cf.cashFromOperations)])
      rows.push(['CapEx', fmtSigned(cf.capex)])
      rows.push(['Change in Long-Term Debt', fmtSigned(cf.changeInLongTermDebt)])
      rows.push(['Change in Short-Term Debt', fmtSigned(cf.changeInShortTermDebt)])
      rows.push(['Change in Equity', fmtSigned(cf.changeInEquity)])
      rows.push(['Dividends Paid', fmtSigned(cf.dividendsPaid)])
      rows.push(['Net Change', fmt(cf.netChange)])
      rows.push(['Ending Cash', fmt(team.cash)])
    }

    const tsv = rows.map((r) => r.join('\t')).join('\n')
    navigator.clipboard.writeText(tsv)
      .then(() => alert(`Copied ${getTeamDisplayName(team)} (${section}) to clipboard!`))
      .catch((err) => console.error('Failed to copy', err))
  }

  const toCashflowInputs = (team: FinancialTeamRow): CashflowStatementInputs => ({
    netProfit: team.netProfit ?? 0,
    depreciation: team.depreciation ?? 0,
    inventory: team.inventory ?? 0,
    receivables: team.receivables ?? 0,
    payables: team.payables ?? 0,
    fixedAssets: team.fixedAssets ?? 0,
    longTermDebt: team.longTermDebt ?? 0,
    shortTermLoans: team.shortTermLoans ?? 0,
    shareCapital: team.shareCapital ?? 0,
    dividends: team.dividends ?? 0,
    cash: team.cash ?? 0,
  })


  const totals = useMemo(() => {
    return orderedTeams.map((team) => {
      const currentAssets = team.cash + team.receivables + team.inventory
      const totalAssets = team.totalAssets || team.fixedAssets + currentAssets
      const currentLiabilities = team.payables + team.shortTermLoans
      const totalLiabilities = team.totalLiabilities || currentLiabilities + team.longTermDebt
      return {
        teamId: team.teamId,
        currentAssets,
        totalAssets,
        currentLiabilities,
        totalLiabilities,
      }
    })
  }, [orderedTeams])

  const getTotalsFor = (teamId: string) =>
    totals.find((row) => row.teamId === teamId)

  const renderRow = (
    label: string,
    values: (team: FinancialTeamRow, prev?: FinancialTeamRow) => number,
    format: (value: number, compact?: boolean) => string = formatCurrency,
    options: { indent?: number; rowClass?: string; isSubtotal?: boolean; isImportant?: boolean; isCheck?: boolean; isGrandTotal?: boolean } = {},
    teamList: FinancialTeamRow[] = orderedTeams
  ) => (
    <tr className={`${options.rowClass || ''} ${options.isSubtotal ? 'row-subtotal' : ''} ${options.isImportant ? 'row-important' : ''} ${options.isCheck ? 'row-check' : ''} ${options.isGrandTotal ? 'row-grand' : ''}`}>
      <td className={`col-label ${options.indent === 1 ? 'indent-1' : options.indent === 2 ? 'indent-2' : ''}`}>
        {label}
        {theme === 'pro' && <span className="label-colon">:</span>}
      </td>
      {teamList.map((team) => {
        const prev = getPrev(previousTeamsEffective, team.teamId)
        const value = values(team, prev)
        const formatted = format(value, compactNumbers)

        let status = ''
        if (options.isCheck) {
          status = ' OK'
        }

        return (
          <td
            key={team.teamId}
            className={`col-num ${highlightTeamId === team.teamId ? 'highlight' : ''}`}
          >
            <span className={value < 0 ? 'negative' : value > 0 ? 'positive' : 'zero'}>
              {formatted}{status}
            </span>
          </td>
        )
      })}
    </tr>
  )

  const renderSection = (label: string) => (
    <tr className="section-header">
      <td colSpan={orderedTeams.length + 1}>{label}</td>
    </tr>
  )

  const renderLabelRow = (label: string) => (
    <tr className="row-label">
      <td className="col-label">
        {label}
      </td>
      {orderedTeams.map((team) => (
        <td key={team.teamId} className="col-num" />
      ))}
    </tr>
  )

  return (
    <div
      className={`report-card ${emphasis === 'bold' ? 'report-bold' : ''} theme-${theme}`}
      data-theme={colorMode}
    >
      <div className="report-header-premium">
        <div className="report-header-content">
          <div className="report-badge">FINANCIAL INTELLIGENCE</div>
          <h1 className="report-title-main">
            {title}

          </h1>
          {subtitle && <p className="report-subtitle-text">{subtitle}</p>}
        </div>

        <div className="report-controls-modern">
          {availableRounds && onRoundChange && (
            <div className="control-group">
              <label className="meta-label">VIEWING ROUND</label>
              <select
                className="modern-select"
                value={currentRound}
                onChange={(e) => onRoundChange(Number(e.target.value))}
              >
                {availableRounds.map((r) => (
                  <option key={r.roundNumber} value={r.roundNumber}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onPrecisionToggle && (
            <div className="control-group">
              <label className="meta-label">PRECISION</label>
              <button
                type="button"
                className="modern-toggle-btn"
                onClick={onPrecisionToggle}
              >
                {compactNumbers ? 'Standard' : 'Detailed'}
              </button>
            </div>
          )}

          <div className="control-group">
            <label className="meta-label">ACTIONS</label>
            <button
              type="button"
              className="modern-toggle-btn"
              style={{ background: 'var(--color-success)', color: '#fff', border: 'none' }}
              onClick={handleExportCSV}
            >
              📥 Export for Audit (CSV)
            </button>
          </div>

          {asOf && !availableRounds && (
            <div className="report-meta-modern">
              <span className="meta-label">REPORTING PERIOD</span>
              <span className="meta-value">{asOf}</span>
            </div>
          )}
        </div>
      </div>

      <div className="nav-tabs-modern">
        <div className="nav-tabs-container">
          <button
            type="button"
            className={`nav-tab-m ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            Balance Sheet
          </button>
          <button
            type="button"
            className={`nav-tab-m ${activeTab === 'pnl' ? 'active' : ''}`}
            onClick={() => setActiveTab('pnl')}
          >
            Profit &amp; Loss
          </button>
          <button
            type="button"
            className={`nav-tab-m ${activeTab === 'cashflow' ? 'active' : ''}`}
            onClick={() => setActiveTab('cashflow')}
          >
            Cash Flow
          </button>
          <button
            type="button"
            className={`nav-tab-m ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Executive Summary
          </button>
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'summary' ? 'active' : ''}`}>
        <div className="kpi-section">
          <div className="section-label">Purchase Intent Index</div>
          <div className="table-scroll">
            <table className="modern-financial-table">
              <thead>
                <tr>
                  <th className="sticky-col">Metric</th>
                  {orderedTeams.map((team) => (
                    <th
                      key={team.teamId}
                      className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                    >
                      {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                      {getTeamDisplayName(team)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderRow('Price', () => 0, () => '')}
                {renderRow(labels.us, (t) => t.priceUS ?? NaN, formatMaybeCurrency, { indent: 1, isSubtotal: true })}
                {renderRow(labels.asia, (t) => t.priceAsia ?? NaN, formatMaybeCurrency, { indent: 1, isSubtotal: true })}
                {renderRow(labels.europe, (t) => t.priceEurope ?? NaN, formatMaybeCurrency, { indent: 1, isSubtotal: true })}
                {renderRow('Features', (t) => t.features ?? NaN, (v) => formatMaybeNumber(v, 0))}
                {renderRow('Promo %', () => 0, () => '')}
                {renderRow(labels.us, (t) => t.promoUS ?? NaN, (v) => formatMaybePercent(v), { indent: 1, isSubtotal: true })}
                {renderRow(labels.asia, (t) => t.promoAsia ?? NaN, (v) => formatMaybePercent(v), { indent: 1, isSubtotal: true })}
                {renderRow(labels.europe, (t) => t.promoEurope ?? NaN, (v) => formatMaybePercent(v), { indent: 1, isSubtotal: true })}
                {renderRow('CSR Rating', (t) => t.csrRating ?? NaN, (v) => formatMaybeNumber(v, 2))}
                {renderRow('Training Budget', (t) => t.trainingBudget ?? NaN, formatMaybeCurrency)}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            className="modern-toggle-btn"
            onClick={() => setShowAdvancedSummary((prev) => !prev)}
          >
            {showAdvancedSummary ? 'Hide More Detail' : 'Show More Detail'}
          </button>
        </div>

        {showAdvancedSummary && (
          <>
            <div className="kpi-section">
              <div className="section-label">
                Performance Highlights
              </div>
              <div className="table-scroll">
                <table className="modern-financial-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">Metric & Analysis</th>
                      {orderedTeams.map((team) => (
                        <th
                          key={team.teamId}
                          className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                            <span>{getTeamDisplayName(team)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'highlights'); }}
                              className="copy-btn-small"
                              title="Copy table column"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                            >
                              📋
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. Total Revenue breakdown by region */}
                    {renderRow('Total Revenue', (t) => t.revenue)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => t.revenueUS, formatCurrency, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => t.revenueAsia, formatCurrency, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.europe, (t) => t.revenueEurope, formatCurrency, { indent: 1, isSubtotal: true })}

                    {/* 2. Net Profit */}
                    {renderRow('Net Profit', (t) => t.netProfit)}

                    {/* 3. Dividends Paid */}
                    {renderRow('Dividends Paid', (t) => t.dividends ?? 0)}

                    {/* 4. Net Margin */}
                    {renderRow('Net Margin', (t) => t.netMargin, formatPercent)}

                    {/* 5. Market Share breakdown by region */}
                    {renderRow(
                      'Market Share (Avg)',
                      (t) => {
                        const shareUS = normalizeShare(t.marketShareUS)
                        const shareAsia = normalizeShare(t.marketShareAsia)
                        const shareEurope = normalizeShare(t.marketShareEurope)
                        if (t.teamId === 'us') return shareUS * 100
                        if (t.teamId === 'asia' || t.teamId === 'CN' || t.teamId === 'IN') return shareAsia * 100
                        if (t.teamId === 'europe' || t.teamId === 'EU') return shareEurope * 100
                        return ((shareUS + shareAsia + shareEurope) / 3) * 100
                      },
                      formatPercent
                    )}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => normalizeShare(t.marketShareUS) * 100, formatPercent, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => normalizeShare(t.marketShareAsia) * 100, formatPercent, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.europe, (t) => normalizeShare(t.marketShareEurope) * 100, formatPercent, { indent: 1, isSubtotal: true })}

                    {/* 6. Units Sold breakdown by region */}
                    {renderRow('Units Sold', (t) => t.unitsSold, formatUnits)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => t.unitsSoldUS ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => t.unitsSoldAsia ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.europe, (t) => t.unitsSoldEurope ?? 0, formatUnits, { indent: 1, isSubtotal: true })}

                    {/* 7. Total Production (Factory + Outsource) breakdown by region */}
                    {renderRow('Total Production', (t) => (t.productionUS ?? 0) + (t.productionAsia ?? 0), formatUnits)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => t.productionUS ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => t.productionAsia ?? 0, formatUnits, { indent: 1, isSubtotal: true })}

                    {/* 8. Outsource Production breakdown by region */}
                    {renderRow('Outsource Production', (t) => (t.outsourceUS ?? 0) + (t.outsourceAsia ?? 0), formatUnits)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => t.outsourceUS ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => t.outsourceAsia ?? 0, formatUnits, { indent: 1, isSubtotal: true })}

                    {/* 9. Inventory Start breakdown by region */}
                    {renderRow('Inventory Start', (t, prev) => t.inventoryStartUnits ?? prev?.inventoryEndUnits ?? 0, formatUnits)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t, prev) => t.inventoryUnitsUS ?? prev?.inventoryUnitsUS ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t, prev) => t.inventoryUnitsAsia ?? prev?.inventoryUnitsAsia ?? 0, formatUnits, { indent: 1, isSubtotal: true })}

                    {/* 10. Inventory End breakdown by region */}
                    {renderRow('Inventory End', (t) => t.inventoryEndUnits ?? 0, formatUnits)}
                    {canShowSummaryBreakdown && renderRow(labels.us, (t) => t.inventoryUnitsUS ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                    {canShowSummaryBreakdown && renderRow(labels.asia, (t) => t.inventoryUnitsAsia ?? 0, formatUnits, { indent: 1, isSubtotal: true })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="kpi-section">
              <div className="section-label">Key Performance Indicators</div>
              <div className="table-scroll">
                <table className="modern-financial-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">KPI Factor</th>
                      {kpiTeams.map((team) => (
                        <th
                          key={team.teamId}
                          className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                            <span>{getTeamDisplayName(team)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'kpi'); }}
                              className="copy-btn-small"
                              title="Copy table column"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                            >
                              📋
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renderRow(
                      'Return on Equity (ROE)',
                      (t) => t.roe,
                      formatPercent,
                      {},
                      kpiTeams
                    )}
                    {renderRow(
                      'Return on Sales (ROS)',
                      (t) => t.netMargin,
                      formatPercent,
                      {},
                      kpiTeams
                    )}
                    {renderRow(
                      'Earnings Per Share (EPS)',
                      (t) => t.eps,
                      formatCurrencyPrecise,
                      {},
                      kpiTeams
                    )}
                    {renderRow(
                      'Total Shareholder Return (TSR)',
                      (t) => t.tsr,
                      formatPercent,
                      {},
                      kpiTeams
                    )}
                    {renderRow(
                      'Dividend Yield',
                      (t) => t.dividendYield,
                      formatPercent,
                      {},
                      kpiTeams
                    )}
                    <tr>
                      <td className="col-label">Share Price</td>
                      {kpiTeams.map((team) => {
                        const prev = getPrev(previousTeamsEffective, team.teamId)
                        const sharePrice = team.sharePrice
                        const fallbackBase = team.sharePriceTrace?.basePrice
                        const prevSharePrice = prev?.sharePrice ?? fallbackBase ?? null
                        const hasPrev = Number.isFinite(prevSharePrice) && (prevSharePrice as number) !== 0
                        const deltaPct = hasPrev ? (sharePrice - (prevSharePrice as number)) / (prevSharePrice as number) : null
                        const deltaLabel = deltaPct === null ? '' : `${deltaPct >= 0 ? '^' : 'v'} ${formatPercent(Math.abs(deltaPct) * 100)}`
                        const deltaColor = deltaPct !== null && deltaPct < 0 ? 'var(--color-danger)' : 'var(--color-success)'
                        return (
                          <td
                            key={team.teamId}
                            className={`col-num ${highlightTeamId === team.teamId ? 'highlight' : ''}`}
                          >
                            <span className={sharePrice < 0 ? 'negative' : sharePrice > 0 ? 'positive' : 'zero'}>
                              {formatCurrencyPrecise(sharePrice, compactNumbers)}
                            </span>
                            {deltaPct !== null && (
                              <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: deltaColor }}>
                                {deltaLabel}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="kpi-section">
              <div className="section-label">Share Price &amp; TSR Breakdown</div>
              <div className="table-scroll">
                <table className="modern-financial-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">Model Components</th>
                      {kpiTeams.map((team) => (
                        <th
                          key={team.teamId}
                          className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                            <span>{getTeamDisplayName(team)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'shareprice'); }}
                              className="copy-btn-small"
                              title="Copy table column"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                                opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                            >
                              📋
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renderRow('Base Price (TSR base)', (t) => t.sharePriceTrace?.basePrice ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Previous Share Price', (t) => t.sharePriceTrace?.prevSharePrice ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('EPS (model)', (t) => t.sharePriceTrace?.eps ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Base P/E Ratio', (t) => t.sharePriceTrace?.basePERatio ?? 0, (v) => v.toFixed(2), {}, kpiTeams)}
                    {renderRow('Growth Premium', (t) => (t.sharePriceTrace?.growthPremium ?? 0) * 100, formatPercent, {}, kpiTeams)}
                    {renderRow('P/E Ratio', (t) => t.sharePriceTrace?.peRatio ?? 0, (v) => v.toFixed(2), {}, kpiTeams)}
                    {renderRow('Model Share Price', (t) => t.sharePriceTrace?.sharePriceBase ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Smoothed Price', (t) => t.sharePriceTrace?.smoothedPrice ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Protected Floor', (t) => t.sharePriceTrace?.protectedFloor ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Final Share Price', (t) => t.sharePriceTrace?.finalSharePrice ?? t.sharePrice, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Shares Outstanding', (t) => t.sharesOutstanding ?? 0, formatUnits, {}, kpiTeams)}
                    {renderRow('Dividends Paid', (t) => t.dividends ?? 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('Dividend / Share', (t) => (t.sharesOutstanding ?? 0) > 0 ? (t.dividends ?? 0) / (t.sharesOutstanding ?? 1) : 0, formatCurrencyPrecise, {}, kpiTeams)}
                    {renderRow('TSR', (t) => t.tsr, formatPercent, {}, kpiTeams)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`tab-content ${activeTab === 'balance' ? 'active' : ''}`}>
        <div className="table-scroll">
          <table className="modern-financial-table">
            <thead>
              <tr>
                <th className="sticky-col">Accounting Line Item</th>
                {orderedTeams.map((team) => (
                  <th
                    key={team.teamId}
                    className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                      <span>{getTeamDisplayName(team)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'balance'); }}
                        className="copy-btn-small"
                        title="Copy table column"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                          opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Removed redundant BALANCE SHEET title row */}
              {renderLabelRow('ASSETS')}
              {renderRow('Cash', (t) => t.cash, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Receivables', (t) => t.receivables, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Inventory', (t) => t.inventory, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Fixed Assets', (t) => t.fixedAssets, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Total Assets', (t) => getTotalsFor(t.teamId)?.totalAssets ?? t.totalAssets, formatCurrency, { isImportant: true })}

              {renderLabelRow('LIABILITIES')}
              {renderRow('Payables', (t) => t.payables, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Short-Term Debt', (t) => t.shortTermLoans, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Long-Term Debt', (t) => t.longTermDebt, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Total Liabilities', (t) => getTotalsFor(t.teamId)?.totalLiabilities ?? t.totalLiabilities, formatCurrency, { isImportant: true })}

              {renderLabelRow('EQUITY')}
              {renderRow('Share Capital', (t) => t.shareCapital, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Retained Earnings', (t) => t.retainedEarnings, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Total Equity', (t) => t.totalEquity, formatCurrency, { isImportant: true })}

              <tr className="row-grand">
                <td className="col-label">Total Liabilities + Equity {theme === 'pro' && <span className="label-colon">:</span>}</td>
                {orderedTeams.map((team) => {
                  const totalLE = (team.totalLiabilities ?? 0) + (team.totalEquity ?? 0)
                  return (
                    <td
                      key={team.teamId}
                      className={`col-num ${highlightTeamId === team.teamId ? 'highlight' : ''}`}
                    >
                      <span className={totalLE < 0 ? 'negative' : totalLE > 0 ? 'positive' : 'zero'}>
                        {formatCurrency(totalLE, compactNumbers)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'pnl' ? 'active' : ''}`}>
        <div className="table-scroll">
          <table className="modern-financial-table">
            <thead>
              <tr>
                <th className="sticky-col">Account Description</th>
                {orderedTeams.map((team) => (
                  <th
                    key={team.teamId}
                    className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                      <span>{getTeamDisplayName(team)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'pnl'); }}
                        className="copy-btn-small"
                        title="Copy table column"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                          opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderSection('STAGE 3: INCOME STATEMENT')}
              {renderRow('Sales Revenue', (t) => t.revenue, formatCurrency)}
              {renderRow('COGS', (t) => t.cogs, formatSignedCurrency)}
              {renderRow('Materials', (t) => t.materials, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Labor', (t) => t.labor, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Transport & Tariffs', (t) => t.logistics, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Outsourcing', (t) => t.outsourcing, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Gross Profit', (t) => t.grossProfit ?? (t.revenue - t.cogs), formatCurrency, { isImportant: true })}
              {renderRow('Admin', (t) => t.admin, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('R&D', (t) => t.rnd, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Marketing', (t) => t.marketing, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Inventory Holding', (t) => t.inventoryHolding ?? 0, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Depreciation', (t) => t.depreciation, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('EBIT', (t) => t.ebit, formatCurrency, { isImportant: true })}
              {renderRow(`Interest (${((industryConfig?.financial?.interestRate || 0.05) * 100).toFixed(0)}%)`, (t) => t.interestExpense, formatSignedCurrency)}
              {renderRow(`Tax (${((industryConfig?.financial?.taxRate || 0.25) * 100).toFixed(0)}%)`, (t) => t.tax, formatSignedCurrency)}
              {renderRow('Tax Loss Carryforward', (t) => t.taxLossCarryforward ?? 0, formatCurrency)}
              {renderRow('Net Profit', (t) => t.netProfit, formatCurrency)}
              {renderRow('Dividends Paid', (t) => t.dividends ?? 0, formatSignedCurrency)}
              {renderRow('Retained Earnings', (t) => (t.netProfit ?? 0) - (t.dividends ?? 0), formatCurrency, { isGrandTotal: true })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'cashflow' ? 'active' : ''}`}>
        <div className="table-scroll">
          <table className="modern-financial-table">
            <thead>
              <tr>
                <th className="sticky-col">Cash Movement Item</th>
                {orderedTeams.map((team) => (
                  <th
                    key={team.teamId}
                    className={highlightTeamId === team.teamId ? 'highlight-header' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {highlightTeamId === team.teamId && <span className="team-indicator">⭐ </span>}
                      <span>{getTeamDisplayName(team)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyTeamTable(team.teamId, 'cashflow'); }}
                        className="copy-btn-small"
                        title="Copy table column"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                          opacity: 0.5, padding: '0 4px', filter: 'grayscale(1)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                      >
                        📋
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderSection('CASHFLOW STATEMENT')}
              {renderRow('Net Profit', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).netProfit, formatCurrency)}
              {renderRow('Depreciation', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).depreciation, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('(Cash from P&L)', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).cashFromPL, formatCurrency, { isSubtotal: true })}

              {renderRow('Change in Inventory', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInInventory, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Change in Receivables', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInReceivables, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Change in Payables', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInPayables, formatSignedCurrency, { indent: 1, isSubtotal: true })}

              {renderRow('Cash from Operations', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).cashFromOperations, formatCurrency, { isImportant: true })}

              {renderRow('CapEx', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).capex, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Change in Long-Term Debt', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInLongTermDebt, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Change in Short-Term Debt', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInShortTermDebt, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Change in Equity', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).changeInEquity, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('Dividends Paid', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).dividendsPaid, formatSignedCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('NET CHANGE IN CASH', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).netChange, formatCurrency, { isImportant: true })}

              {renderRow('Starting Cash (from Phase 1)', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).startingCash, formatCurrency)}
              {renderRow('Net Change in Cash', (t, prev) => calculateCashflowStatement(toCashflowInputs(t), prev ? toCashflowInputs(prev) : undefined).netChange, formatCurrency, { indent: 1, isSubtotal: true })}
              {renderRow('ENDING CASH', (t) => t.cash, formatCurrency, { isGrandTotal: true })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-footer-disclaimer">
        <p><strong>Educational Disclaimer:</strong> This financial report is part of an academic business simulation. All figures, companies, and outcomes are entirely fictional and produced for training purposes only. Values shown do not reflect real-world financial results or market conditions.</p>
      </div>

      <style>{`
        /* Pro Finance Theme */
        .report-card.theme-pro {
          background: #000000;
          color: #ffffff;
          border-color: #333;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .theme-pro .report-header-premium {
          background: #000000;
          border-bottom: 1px solid #222;
        }

        .theme-pro .report-title-main {
          color: #fff !important;
        }

        .theme-pro .nav-tabs-modern {
          background: #000000;
          border-bottom: 1px solid #222;
          padding: 1rem 2.5rem;
        }

        .theme-pro .nav-tabs-container {
          background: #111;
          border-color: #333;
        }

        .theme-pro .nav-tab-m {
          color: #888;
        }

        .theme-pro .nav-tab-m.active {
          background: #222;
          color: #ffaa00;
          box-shadow: none;
        }

        .theme-pro .modern-financial-table th {
          background: #000000;
          color: #888;
          border-bottom: 2px solid #222;
          font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
          padding: 0.3rem 0.8rem;
        }

        .theme-pro .modern-financial-table th.sticky-col,
        .theme-pro .modern-financial-table td.col-label {
          background: #000000;
          color: #fff;
        }

        .theme-pro .modern-financial-table td {
          border-bottom: 1px solid transparent;
          font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
          color: #66ccff; /* Pro Blue */
          padding: 0.2rem 0.8rem;
        }

        .theme-pro .modern-financial-table .col-label {
           font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
           font-weight: 700;
        }

        .theme-pro .section-header td {
          background: transparent;
          color: #ffaa00; /* Pro Orange */
          border-bottom: 1px solid #333;
          font-size: 0.9rem;
          font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
          padding-top: 0.8rem; padding-bottom: 0.2rem;
        }

        .theme-pro .row-subtotal td {
          color: #888 !important;
        }

        .theme-pro .row-label td {
          color: #ffffff !important;
          font-weight: 700;
          border-bottom: 1px solid #222;
          padding-top: 1rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .theme-pro .row-subtotal .col-label {
          position: relative;
          padding-left: 1.8rem !important;
        }

        .theme-pro .row-subtotal .col-label::before {
          content: "";
          position: absolute;
          left: 0.8rem;
          top: 0;
          bottom: 0;
          width: 1.5px;
          background: var(--pro-border-strong);
        }
        
        .theme-pro .zero {
          color: var(--text-muted) !important;
          opacity: 0.6 !important;
        }

        /* Responsive variables for Pro Theme */
        .report-card.theme-pro {
          --pro-bg: #0b1120;               /* Deeper Slate for card base */
          --pro-header-bg: #1e293b;        /* Slate 800 for headers */
          --pro-text: #f8fafc;             /* Slate 50 */
          --pro-muted: #94a3b8;            /* Slate 400 */
          --pro-border: #1e293b;           /* Slate 800 */
          --pro-border-strong: #334155;    /* Slate 700 */
          --pro-accent: #60a5fa;           /* Blue 400 */
          --pro-accent-bg: rgba(96, 165, 250, 0.08);
          --pro-blue: #93c5fd;             /* Blue 300 */
          --pro-amber: #fbbf24;            /* Amber 400 */
          --pro-success: #34d399;          /* Emerald 400 */
          --pro-danger: #f87171;           /* Red 400 */
          --pro-row-hover: #1e293b;        /* Slate 800 */
          --pro-nav-active: #334155;       /* Slate 700 */
          --pro-nav-bg: #0b1120;           /* Sync with bg */
          --pro-highlight: rgba(96, 165, 250, 0.1);
          --pro-highlight-header: rgba(96, 165, 250, 0.15);
          --pro-surface: #111827;          /* Distinct surface for data areas */
          --pro-nav-text-active: #ffffff;
        }

        .report-card.theme-pro[data-theme='light'] {
          --pro-bg: #f8fafc;               /* Off-white for contrast against white page */
          --pro-header-bg: #ffffff;        /* Pure white for headers */
          --pro-text: #0f172a;
          --pro-muted: #64748b;
          --pro-border: #e2e8f0;
          --pro-border-strong: #cbd5e1;
          --pro-accent: #2563eb;
          --pro-accent-bg: rgba(37, 99, 235, 0.04);
          --pro-blue: #3b82f6;
          --pro-amber: #d97706;            /* Amber 600 */
          --pro-success: #10b981;
          --pro-danger: #ef4444;
          --pro-row-hover: #f1f5f9;
          --pro-nav-active: #ffffff;
          --pro-nav-bg: #e2e8f0;
          --pro-highlight: rgba(37, 99, 235, 0.06);
          --pro-highlight-header: rgba(37, 99, 235, 0.1);
          --pro-surface: #ffffff;
          --pro-nav-text-active: var(--pro-accent);
        }

        /* Apply Pro variables */
        .report-card.theme-pro {
          background: var(--pro-bg);
          color: var(--pro-text);
          border: 1px solid var(--pro-border-strong);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .theme-pro .report-header-premium {
          background: var(--pro-header-bg);
          border-bottom: 1px solid var(--pro-border);
        }

        .theme-pro .report-title-main {
          color: var(--pro-text) !important;
        }

        .theme-pro .nav-tabs-modern {
          background: var(--pro-header-bg);
          border-bottom: 1px solid var(--pro-border);
        }

        .theme-pro .nav-tabs-container {
          background: var(--pro-nav-bg);
          border-color: var(--pro-border);
        }

        .theme-pro .nav-tab-m {
          color: var(--pro-muted);
        }

        .theme-pro .nav-tab-m.active {
          background: var(--pro-nav-active);
          color: var(--pro-nav-text-active);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .theme-pro .modern-financial-table th {
          background: var(--pro-bg);
          color: var(--pro-muted);
          border-bottom: 2px solid var(--pro-border);
        }

        .theme-pro .modern-financial-table {
           background: var(--pro-surface);
           border: 1px solid var(--pro-border);
           border-radius: 8px;
           overflow: hidden;
        }

        .theme-pro .modern-financial-table th.sticky-col,
        .theme-pro .modern-financial-table td.col-label {
          background: var(--pro-surface); 
          color: var(--pro-text);
          border-right: 1px solid var(--pro-border);
        }

        .theme-pro .modern-financial-table th {
          background: var(--pro-header-bg);
          color: var(--pro-muted);
          border-bottom: 2px solid var(--pro-border);
        }
        
        .theme-pro .modern-financial-table th.sticky-col {
           background: var(--pro-header-bg);
        }

        .theme-pro .modern-financial-table td {
          color: var(--pro-blue);
        }

        .theme-pro .section-header td {
          color: var(--pro-accent);
          background: var(--pro-header-bg) !important;
          border-bottom: 1.5px solid var(--pro-border);
          border-top: none !important;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding-top: 1.2rem;
        }

        .theme-pro .section-label {
          color: var(--pro-accent);
          font-weight: 800;
          font-size: 0.7rem;
        }

        .theme-pro .row-subtotal td {
          color: var(--pro-muted) !important;
          font-size: 0.7rem;
          font-weight: 400;
          background: transparent !important;
          border-top: none !important;
        }

        .theme-pro tr:not(.row-subtotal) + .row-subtotal td {
          border-top: 1px dashed var(--pro-border) !important;
        }

        .theme-pro .row-subtotal .negative,
        .theme-pro .row-subtotal .positive,
        .theme-pro .row-subtotal .zero {
          color: var(--pro-muted) !important;
        }

        .theme-pro .row-label td {
          color: var(--pro-amber) !important;
          background: transparent !important;
          border-bottom: none !important;
          border-top: none !important;
          font-weight: 800;
          font-size: 0.75rem;
          padding: 0.45rem 0.8rem;
        }

        .theme-pro .row-subtotal .col-label::before {
          content: "";
          position: absolute;
          left: 0.8rem;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--pro-border);
        }

        /* First subitem in a group: line starts from middle */
        .theme-pro tr:not(.row-subtotal) + .row-subtotal .col-label::before {
          top: 50%;
        }

        /* Last subitem in a group: line ends at middle */
        .theme-pro .row-subtotal:has(+ tr:not(.row-subtotal)) .col-label::before {
          bottom: 50%;
        }
        
        /* Single subitem: no vertical line, only the connector dash */
        .theme-pro tr:not(.row-subtotal) + .row-subtotal:has(+ tr:not(.row-subtotal)) .col-label::before {
          display: none;
        }

        .theme-pro .row-subtotal .col-label::after {
          content: "";
          position: absolute;
          left: 0.8rem;
          top: 50%;
          width: 0.5rem;
          height: 1px;
          background: var(--pro-border);
        }
        
        .theme-pro .row-important td {
          border-top: 2px solid var(--pro-border-strong) !important;
          background: transparent !important;
          font-weight: 700;
        }
        
        .theme-pro .row-important .col-label {
           color: var(--pro-text) !important;
           background: transparent !important;
        }

        .theme-pro .row-check td,
        .theme-pro .row-grand td {
          border-top: 2px solid var(--pro-accent) !important;
          color: var(--pro-success) !important;
          background: var(--pro-accent-bg) !important;
          font-weight: 800;
        }

        .theme-pro .row-grand .col-label {
           color: var(--pro-text) !important;
           background: var(--pro-accent-bg) !important;
        }

        .theme-pro .modern-financial-table tr:hover td {
          background: var(--pro-row-hover) !important;
        }
        
        .theme-pro .modern-financial-table tr:hover td.col-label {
          background: var(--pro-row-hover) !important;
        }

        .theme-pro .report-badge {
           background: var(--pro-accent-bg);
           color: var(--pro-accent);
           border: 1px solid var(--pro-border);
        }

        .theme-pro .report-meta-modern {
           background: var(--pro-nav-bg);
           border-color: var(--pro-border);
        }

        .theme-pro .meta-value {
           color: var(--pro-accent);
        }

        .theme-pro .modern-select {
          background: var(--pro-nav-bg);
          border-color: var(--pro-border);
          color: var(--pro-accent);
        }

        .theme-pro .modern-toggle-btn {
          background: var(--pro-nav-bg);
          color: var(--pro-accent);
          border: 1px solid var(--pro-border);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .theme-pro .modern-toggle-btn:hover {
          background: var(--pro-nav-active);
          border-color: var(--pro-accent);
        }

        .theme-pro .meta-label {
          color: var(--pro-muted);
        }

        .theme-pro .zero {
          color: var(--pro-muted) !important;
        }

        .report-card {
          background: var(--bg-card);
          border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);
          overflow: hidden;
          border: 1px solid var(--border-color);
          margin-top: 1rem;
        }

        .report-header-premium {
          padding: 1.5rem 2.5rem;
          background: linear-gradient(to right, rgba(37, 99, 235, 0.05), transparent);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          gap: 2rem;
        }

        .report-controls-modern {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modern-select {
          background: var(--bg-page);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 8px 32px 8px 12px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          min-width: 160px;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 14px;
        }

        .modern-toggle-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }

        .modern-toggle-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
        }

        .report-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          padding: 4px 10px;
          border-radius: 4px;
          letter-spacing: 1px;
          margin-bottom: 0.75rem;
        }

        .report-title-main {
          font-size: 1.5rem !important;
          font-weight: 800 !important;
          color: var(--text-main) !important;
          margin: 0 !important;
          letter-spacing: -0.5px;
        }

        .report-subtitle-text {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin: 0.25rem 0 0 0;
        }

        .report-meta-modern {
          text-align: right;
          background: var(--bg-page);
          padding: 0.75rem 1.25rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meta-label {
          font-size: 0.6rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.5px;
        }

        .meta-value {
          font-size: 0.85rem;
          font-weight: 700;
          color: #2563eb;
        }

        .nav-tabs-modern {
          padding: 0.75rem 2.5rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-color);
        }

        .nav-tabs-container {
          background: var(--bg-page);
          padding: 4px;
          border-radius: 12px;
          display: flex;
          gap: 4px;
          width: fit-content;
          border: 1px solid var(--border-color);
        }

        .nav-tab-m {
          padding: 8px 18px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 9px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          border: none;
        }

        .nav-tab-m:hover {
          color: var(--text-main);
          background: rgba(0,0,0,0.05);
        }

        .nav-tab-m.active {
          background: white;
          color: #2563eb;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .tab-content {
          display: none;
          padding: 2rem 2.5rem;
        }

        .tab-content.active {
          display: block;
        }

        .kpi-section {
          margin-bottom: 2.5rem;
        }

        .section-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #2563eb;
          margin-bottom: 1.25rem;
          padding: 0 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modern-financial-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.8rem;
          table-layout: fixed;
        }

        .modern-financial-table th {
          background: var(--bg-page);
          color: var(--text-muted);
          font-weight: 700;
          padding: 0.6rem 0.8rem;
          text-align: right;
          border-bottom: 2px solid var(--border-color);
          white-space: nowrap;
        }

        .modern-financial-table th.sticky-col {
          position: sticky;
          left: 0;
          z-index: 10;
          text-align: left;
          background: var(--bg-page);
          min-width: 250px;
          width: 250px;
        }

        .modern-financial-table td {
          padding: 0.45rem 0.8rem;
          border-bottom: 1px solid var(--border-light);
          text-align: right;
          font-family: var(--font-mono);
          vertical-align: middle;
        }

        .modern-financial-table td.col-label {
          text-align: left;
          font-family: inherit;
          font-weight: 500;
          color: var(--text-main);
          position: sticky;
          left: 0;
          background: var(--bg-card);
          z-index: 5;
          box-shadow: 4px 0 8px -4px rgba(0,0,0,0.05);
        }

        .modern-financial-table tr:hover td {
          background: var(--bg-hover) !important;
        }

        .modern-financial-table .indent-1 {
          padding-left: 2rem;
          color: var(--text-secondary);
        }

        .modern-financial-table .indent-2 {
          padding-left: 3.5rem;
          color: var(--text-muted);
          font-style: italic;
          font-size: 0.75rem;
        }

        /* Subtotal numbers should be grey like their labels */
        .row-subtotal td {
          color: var(--text-secondary) !important;
          font-size: 0.7rem;
          background: rgba(0, 0, 0, 0.01);
        }

        .row-subtotal .negative,
        .row-subtotal .positive,
        .row-subtotal .zero {
          color: var(--text-secondary) !important;
        }

        .section-header td {
          background: rgba(37, 99, 235, 0.03);
          font-weight: 800;
          color: #1e40af;
          text-align: left !important;
          padding: 0.75rem 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 0.7rem;
        }

        .row-important td {
          font-weight: 700;
          background: rgba(37, 99, 235, 0.04);
          border-top: 1.5px solid var(--border-color);
        }

        .total-row td {
          font-weight: 700;
          background: rgba(37, 99, 235, 0.04);
          border-top: 1.5px solid var(--border-color);
        }

        .grand-total td {
          background: rgba(37, 99, 235, 0.06) !important;
          font-weight: 800;
          color: #2563eb;
          border-top: 2px solid #2563eb;
          border-bottom: 2px solid #2563eb;
        }

        .row-grand td {
          background: rgba(37, 99, 235, 0.06) !important;
          font-weight: 700;
          border-top: 1.5px solid var(--border-color);
        }

        .row-label td {
          background: rgba(37, 99, 235, 0.05);
          font-weight: 800;
          color: #1e40af;
          padding-top: 0.6rem;
        }

        .highlight-header {
          color: var(--pro-accent, #2563eb) !important;
        }

        .modern-financial-table td.highlight {
          /* Removed background highlight per user request */
        }
        
        .modern-financial-table .col-num.highlight {
          /* Removed background highlight per user request */
        }

        .team-indicator {
          font-size: 0.9rem;
          vertical-align: middle;
        }

        .negative {
          color: #ef4444;
          font-weight: 600;
        }

        .positive {
          color: #10b981;
          font-weight: 600;
        }

        .zero {
          color: var(--text-muted);
          opacity: 0.5;
        }

        .report-footer-disclaimer {
          margin: 3rem 2.5rem 2rem;
          padding: 1.5rem;
          border-top: 1px solid var(--pro-border, rgba(0,0,0,0.1));
          border-radius: 8px;
          background: var(--pro-accent-bg, rgba(0, 0, 0, 0.03));
        }

        .report-footer-disclaimer p {
          margin: 0;
          font-size: 0.75rem;
          line-height: 1.5;
          color: var(--pro-muted, #64748b);
          text-align: center;
          max-width: 800px;
          margin: 0 auto;
        }

        .theme-pro .report-footer-disclaimer {
          background: var(--pro-accent-bg);
          border-top: 1px solid var(--pro-border);
        }

        .report-card[data-theme='dark'] .report-footer-disclaimer {
          background: rgba(255, 255, 255, 0.05);
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
