export interface RoundResult {
  round: number;
  teamId: string;

  // Profit & Loss
  pnl: ProfitAndLoss;

  // Balance Sheet
  balanceSheet: BalanceSheet;

  // Market Share
  marketShare: MarketShare;

  // Financial Ratios
  ratios: FinancialRatios;

  // Operational Metrics
  operational: OperationalMetrics;
}

export interface ProfitAndLoss {
  revenue: RegionalRevenue;
  costs: Costs;
  ebitda: number;
  depreciation: number;
  ebit: number;
  netFinancing: number;
  profitBeforeTax: number;
  incomeTax: number;
  profitAfterTax: number;
}

export interface RegionalRevenue {
  us: number;
  asia: number;
  europe: number;
  total: number;
}

export interface Costs {
  cogs: number; // Cost of Goods Sold
  transportation: number;
  promotion: number;
  admin: number;
  rnd: number;
  total: number;
}

export interface BalanceSheet {
  assets: Assets;
  liabilities: Liabilities;
  equity: Equity;
}

export interface Assets {
  fixedAssets: number;
  inventory: number;
  receivables: number;
  cash: number;
  total: number;
}

export interface Liabilities {
  longtermLoans: number;
  shorttermLoans: number;
  payables: number;
  total: number;
}

export interface Equity {
  shareCapital: number;
  retainedEarnings: number;
  profitForRound: number;
  total: number;
}

export interface MarketShare {
  us: TechMarketShare;
  asia: TechMarketShare;
  europe: TechMarketShare;
}

export interface TechMarketShare {
  tech1: number; // percentage 0-100
  tech2: number;
  tech3: number;
  tech4: number;
}

export interface FinancialRatios {
  roe: number; // Return on Equity (%)
  ros: number; // Return on Sales (%)
  eps: number; // Earnings per Share
  marketCap: number;
  sharePrice: number;
  peRatio: number; // Price-to-Earnings
}

export interface OperationalMetrics {
  hrEfficiency: number; // multiplier (e.g., 1.1 = 110%)
  hrTurnover: number; // percentage
  capacityUtilization: {
    us: number; // percentage
    asia: number;
  };
}
