export type LegacyTeam = {
  id: number;
  name: string;
  color: string;
};

export const DEFAULT_TEAMS: LegacyTeam[] = [
  { id: 1, name: 'Cherry', color: '#f56565' },
  { id: 2, name: 'Banana', color: '#ecc94b' },
  { id: 3, name: 'Durian', color: '#48bb78' },
];
