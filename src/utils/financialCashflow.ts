export type CashflowStatementInputs = {
  netProfit: number
  depreciation: number
  inventory: number
  receivables: number
  payables: number
  fixedAssets: number
  longTermDebt: number
  shortTermLoans?: number
  shareCapital: number
  dividends?: number
  cash: number
  netChangeOverride?: number | null
}

export type CashflowStatement = {
  netProfit: number
  depreciation: number
  cashFromPL: number
  changeInInventory: number
  changeInReceivables: number
  changeInPayables: number
  cashFromOperations: number
  capex: number
  changeInLongTermDebt: number
  changeInShortTermDebt: number
  changeInEquity: number
  dividendsPaid: number
  netChange: number
  startingCash: number
  endingCash: number
}

export function calculateCashflowStatement(
  current: CashflowStatementInputs,
  prev?: CashflowStatementInputs
): CashflowStatement {
  const cashFromPL = current.netProfit + current.depreciation
  const changeInInventory = prev ? (current.inventory - prev.inventory) * -1 : 0
  const changeInReceivables = prev ? (current.receivables - prev.receivables) * -1 : 0
  const changeInPayables = prev ? (current.payables - prev.payables) : 0
  const cashFromOperations = cashFromPL + changeInInventory + changeInReceivables + changeInPayables
  const capexRaw = prev ? Math.max(0, current.fixedAssets - prev.fixedAssets + current.depreciation) : 0
  const capex = -capexRaw
  const changeInLongTermDebt = prev ? (current.longTermDebt - prev.longTermDebt) : 0
  const changeInShortTermDebt = prev ? (current.shortTermLoans ?? 0) - (prev.shortTermLoans ?? 0) : 0
  const changeInEquity = prev ? (current.shareCapital - prev.shareCapital) : 0
  const dividendsPaid = -(current.dividends ?? 0)
  const netChangeComputed = cashFromOperations + capex + changeInLongTermDebt + changeInShortTermDebt + changeInEquity + dividendsPaid
  const netChange = current.netChangeOverride ?? netChangeComputed
  const startingCash = prev ? prev.cash : current.cash - netChange
  const endingCash = current.cash

  return {
    netProfit: current.netProfit,
    depreciation: current.depreciation,
    cashFromPL,
    changeInInventory,
    changeInReceivables,
    changeInPayables,
    cashFromOperations,
    capex,
    changeInLongTermDebt,
    changeInShortTermDebt,
    changeInEquity,
    dividendsPaid,
    netChange,
    startingCash,
    endingCash,
  }
}
