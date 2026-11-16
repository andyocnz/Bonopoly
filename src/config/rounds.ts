export type LegacyRound = {
  round: number;
  description: string;
  deadline: string;
  scenarioIds: {
    us: number;
    asia: number;
    europe: number;
  };
};

export const DEFAULT_ROUNDS: LegacyRound[] = [
  {
    round: 0,
    deadline: '2014-09-18 05:17:06',
    description: 'Opening round with high volatility (scenarios 8,6,8)',
    scenarioIds: { us: 8, asia: 6, europe: 8 },
  },
  {
    round: 1,
    deadline: '2014-09-18 17:17:06',
    description: 'Round 1 steady mix (scenarios 5,3,5)',
    scenarioIds: { us: 5, asia: 3, europe: 5 },
  },
  {
    round: 2,
    deadline: '2014-09-19 05:17:06',
    description: 'Round 2 pivot with crisis face-off (5,6,5)',
    scenarioIds: { us: 5, asia: 6, europe: 5 },
  },
  {
    round: 3,
    deadline: '2014-09-19 05:18:11',
    description: 'Round 3 favors innovation (1,3,1)',
    scenarioIds: { us: 1, asia: 3, europe: 1 },
  },
  {
    round: 4,
    deadline: '2014-09-18 17:18:11',
    description: 'Round 4 pushes for balanced demand (3,4,4)',
    scenarioIds: { us: 3, asia: 4, europe: 4 },
  },
];

export const getScenarioForRound = (
  round: LegacyRound,
  region: keyof LegacyRound['scenarioIds'],
): number => round.scenarioIds[region];
