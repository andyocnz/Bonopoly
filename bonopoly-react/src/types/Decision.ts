export interface Decision {
  round: number;
  teamId: string;
  timestamp: string;
  submitted: boolean;
  production: ProductionDecision;
  hr: HRDecision;
  rnd: RnDDecision;
  investment: InvestmentDecision;
  logistics: LogisticsDecision;
  marketing: MarketingDecision;
  finance: FinanceDecision;
}

export interface ProductionDecision {
  demandForecast: MarketDemand;
  capacityAllocation: PlantCapacity;
  suppliers: { [plantId: string]: string }; // plantId => supplierId
  outsourcing: { [plantId: string]: number }; // plantId => percentage (0-100)
}

export interface MarketDemand {
  us: TechDemand;
  asia: TechDemand;
  europe: TechDemand;
}

export interface TechDemand {
  tech1: number;
  tech2: number;
  tech3: number;
  tech4: number;
}

export interface PlantCapacity {
  us: TechCapacity;
  asia: TechCapacity;
}

export interface TechCapacity {
  tech1: number; // percentage of plant capacity (0-100)
  tech2: number;
  tech3: number;
  tech4: number;
}

export interface HRDecision {
  employeeCount: number;
  monthlySalary: number; // USD
  monthlyTrainingBudget: number; // USD
}

export interface RnDDecision {
  techInvestments: TechInvestments;
  featureInvestments: { [feature: string]: number }; // feature => amount
  licensing: { [techOrFeature: string]: boolean }; // buy license?
}

export interface TechInvestments {
  tech1: number;
  tech2: number;
  tech3: number;
  tech4: number;
}

export interface InvestmentDecision {
  newPlants: {
    us: number; // number of new plants to build
    asia: number;
  };
}

export interface LogisticsDecision {
  deliveryPriority: {
    usPlants: string[]; // ['us', 'asia', 'europe'] in priority order
    asiaPlants: string[];
  };
}

export interface MarketingDecision {
  products: { [tech: string]: ProductMarketing };
}

export interface ProductMarketing {
  features: number; // number of features (0-10)
  price: MarketPrices;
  promotion: MarketPromotion; // percentage (0-100)
}

export interface MarketPrices {
  us: number;
  asia: number;
  europe: number;
}

export interface MarketPromotion {
  us: number; // percentage
  asia: number;
  europe: number;
}

export interface FinanceDecision {
  transferPricing: TransferPricing; // multiplier 1.0-2.0
  longtermDebt: number; // amount to borrow/repay
  shareIssuance: number; // amount to issue/buyback
  dividends: number; // amount to pay
}

export interface TransferPricing {
  us: number; // 1.0 - 2.0
  asia: number;
  europe: number;
}
