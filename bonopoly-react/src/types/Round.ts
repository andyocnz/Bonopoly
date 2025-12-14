export interface Round {
  round: number; // 1-5
  deadline: string; // ISO datetime
  scenario: string;
  marketParams: MarketParamsSet;
}

export interface MarketParamsSet {
  us: MarketParams;
  asia: MarketParams;
  europe: MarketParams;
}

export interface MarketParams {
  changeDemand: number;
  unitCostMaterial: number;
  labour: number;
  tax: number;
  interest: number;
  minWage: number;
  outsourceCapacity: number;
  costTech1: number;
  costTech2: number;
  costTech3: number;
  costTech4: number;
  tariff: number;
  transportation: number;
  receivablesRate: number;
  payablesRate: number;
}
