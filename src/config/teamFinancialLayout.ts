export type FinanceRow = {
  key: string
  label: string
  emphasis?: boolean
}

export type FinanceSection = {
  title: string
  rows: FinanceRow[]
}

export const TEAM_FINANCIAL_LAYOUT: FinanceSection[] = [
  {
    title: 'Sales revenue',
    rows: [
      { key: 'from_market', label: '- From markets' },
      { key: 'transfer', label: '- From internal transfer' },
      { key: 'revenue_total', label: 'Total revenue', emphasis: true },
    ],
  },
  {
    title: 'Costs and expenses',
    rows: [
      { key: 'var_cost_total', label: '- Variable production costs' },
      { key: 'feature', label: '- Feature costs' },
      { key: 'trans', label: '- Transportation & tariffs' },
      { key: 'rnd', label: '- Research & development' },
      { key: 'admin', label: '- Administration' },
      { key: 'costofimport', label: '- Cost of imported products' },
      { key: 'total_cost', label: 'Total costs and expenses', emphasis: true },
    ],
  },
  {
    title: 'EBITDA',
    rows: [
      { key: 'ebitda', label: 'EBITDA', emphasis: true },
      { key: 'depreciation', label: '- Depreciation from fixed assets' },
    ],
  },
  {
    title: 'EBIT',
    rows: [
      { key: 'ebit', label: 'EBIT', emphasis: true },
      { key: 'netfinance', label: '- Net financing expenses' },
    ],
  },
  {
    title: 'Profit',
    rows: [
      { key: 'profit_b4_tax', label: 'Profit before taxes', emphasis: true },
      { key: 'income_tax', label: '- Income taxes' },
      { key: 'profit_after_tax', label: 'Profit after taxes', emphasis: true },
    ],
  },
  {
    title: 'Balance sheet',
    rows: [
      { key: 'Fixed_assets', label: 'Fixed assets' },
      { key: 'Inventory', label: 'Inventory' },
      { key: 'Receivables', label: 'Receivables' },
      { key: 'Cash', label: 'Cash' },
      { key: 'Total_assets', label: 'Total assets', emphasis: true },
      { key: 'Longterm_loans', label: 'Long-term loans' },
      { key: 'Short_term_loans', label: 'Short-term loans' },
      { key: 'Payables', label: 'Payables' },
      { key: 'Total_liabilities', label: 'Total liabilities', emphasis: true },
      { key: 'Total_equity', label: 'Total equity' },
      { key: 'Total_shareholder', label: 'Total shareholder' },
    ],
  },
  {
    title: 'Ratios',
    rows: [
      { key: 'Market_cap', label: 'Market cap' },
      { key: 'Share_price_end', label: 'Share price end' },
      { key: 'EPS', label: 'EPS' },
      { key: 'ROE', label: 'ROE' },
      { key: 'ROCE', label: 'ROCE' },
    ],
  },
]
