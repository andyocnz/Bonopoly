export interface Game {
  id: string;
  name: string;
  noOfTeams: number; // max 5
  noOfRounds: number; // max 5, typically 3
  costEquation: string; // e.g., "0.9,6,-0.85,1.5"
  hrStandardWage: number;
  hrStandardTrainingBudget: number;
  depreciationRate: number;
  minCash: number;
  techAvailability: TechAvailability;
  createdAt: string;
}

export interface TechAvailability {
  us: string[]; // ['tech1', 'tech2', ...]
  asia: string[];
  europe: string[];
}

export interface GameConfig {
  [key: string]: string | number;
}
