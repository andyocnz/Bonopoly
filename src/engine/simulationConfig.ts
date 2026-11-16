/**
 * Simulation Configuration Constants
 *
 * Central location for all simulation parameters and magic numbers.
 * This improves maintainability and makes tuning easier.
 */

export const SIMULATION_CONFIG = {
  /**
   * Random seed generation range
   * Used for reproducible simulations
   */
  SEED: {
    MIN: 0,
    MAX: 10000,
    DEFAULT: () => Math.floor(Math.random() * 10000),
  },

  /**
   * Batch simulation performance settings
   */
  BATCH: {
    /** Number of simulations to run concurrently in each chunk */
    CHUNK_SIZE: 10,
    /** Delay between chunks to allow UI updates (ms) */
    CHUNK_DELAY: 0,
  },

  /**
   * Animation and UI timing
   */
  ANIMATION: {
    /** Delay between round updates in visualizer mode (ms) */
    ROUND_DELAY: 80,
    /** Debounce delay for config changes (ms) */
    CONFIG_DEBOUNCE: 300,
  },

  /**
   * Default simulation parameters
   */
  DEFAULTS: {
    /** Number of teams in simulation */
    TEAM_COUNT: 4,
    /** Number of rounds to simulate */
    ROUNDS: 20,
    /** Default scenario ID */
    SCENARIO_ID: 1,
    /** Default batch experiment size */
    BATCH_GAMES_COUNT: 100,
  },

  /**
   * Simulation constraints and limits
   */
  LIMITS: {
    /** Minimum number of teams */
    MIN_TEAMS: 2,
    /** Maximum number of teams */
    MAX_TEAMS: 8,
    /** Minimum number of rounds */
    MIN_ROUNDS: 5,
    /** Maximum number of rounds */
    MAX_ROUNDS: 100,
    /** Minimum batch size */
    MIN_BATCH_SIZE: 10,
    /** Maximum batch size */
    MAX_BATCH_SIZE: 1000,
  },

  /**
   * Default strategy assignments for new teams
   */
  DEFAULT_STRATEGIES: [
    'predatory-pricing',
    'tit-for-tat',
    'capacity-leader',
    'innovator',
  ],

  /**
   * Advanced game configuration defaults
   */
  ADVANCED_DEFAULTS: {
    /** Default capacity per plant (units) */
    CAPACITY_PER_PLANT: 325000,
    /** Default starting cash ($) */
    STARTING_CASH: 50000000,
    /** Default US plant cost ($) */
    PLANT_COST_US: 30000000,
    /** Default Asia plant cost ($) */
    PLANT_COST_ASIA: 20000000,
    /** Default global price elasticity multiplier */
    GLOBAL_ELASTICITY: 1.0,
    /** Default global demand multiplier */
    GLOBAL_DEMAND: 1.0,
  },

  /**
   * History tracking configuration
   */
  HISTORY: {
    /** Number of previous rounds to track */
    WINDOW_SIZE: 5,
    /** Whether to include full decision history */
    TRACK_DECISIONS: true,
    /** Whether to include market snapshots */
    TRACK_MARKET_DATA: true,
  },

  /**
   * Statistical analysis configuration
   */
  STATISTICS: {
    /** Significance level for hypothesis testing */
    ALPHA: 0.05,
    /** Confidence level for intervals */
    CONFIDENCE_LEVEL: 0.95,
    /** Minimum sample size for valid statistical tests */
    MIN_SAMPLE_SIZE: 30,
  },

  /**
   * Chart and visualization settings
   */
  CHARTS: {
    /** Default metric to display */
    DEFAULT_METRIC: 'sharePrice' as const,
    /** Team color palette */
    TEAM_COLORS: [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ],
  },

  /**
   * Market data fallback values (used when actual data unavailable)
   * These should be replaced by real calculations in production
   */
  MARKET_FALLBACK: {
    PRICE: {
      us: 100,
      asia: 90,
      europe: 110,
    },
    DEMAND: {
      us: 300000,
      asia: 600000,
      europe: 200000,
    },
  },

  /**
   * Validation error messages
   */
  VALIDATION_MESSAGES: {
    NEGATIVE_VALUE: 'Value cannot be negative',
    OUT_OF_RANGE: 'Value is out of acceptable range',
    INVALID_TEAM_COUNT: 'Team count must be between 2 and 8',
    INVALID_ROUNDS: 'Rounds must be between 5 and 100',
    INVALID_CAPACITY: 'Capacity per plant must be positive',
    INVALID_CASH: 'Starting cash must be positive',
    INVALID_PLANT_COST: 'Plant cost must be positive',
  },
} as const

/**
 * Type-safe access to team colors
 */
export function getTeamColor(index: number): string {
  return SIMULATION_CONFIG.CHARTS.TEAM_COLORS[index % SIMULATION_CONFIG.CHARTS.TEAM_COLORS.length]
}

/**
 * Generate a random simulation seed
 */
export function generateSeed(): number {
  return SIMULATION_CONFIG.SEED.DEFAULT()
}

/**
 * Validate simulation configuration
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateSimulationConfig(config: {
  teamCount?: number
  rounds?: number
  capacityPerPlant?: number
  startingCash?: number
  plantCostUS?: number
  plantCostAsia?: number
}): ValidationResult {
  const errors: string[] = []

  // Validate team count
  if (config.teamCount !== undefined) {
    if (config.teamCount < SIMULATION_CONFIG.LIMITS.MIN_TEAMS ||
        config.teamCount > SIMULATION_CONFIG.LIMITS.MAX_TEAMS) {
      errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_TEAM_COUNT)
    }
  }

  // Validate rounds
  if (config.rounds !== undefined) {
    if (config.rounds < SIMULATION_CONFIG.LIMITS.MIN_ROUNDS ||
        config.rounds > SIMULATION_CONFIG.LIMITS.MAX_ROUNDS) {
      errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_ROUNDS)
    }
  }

  // Validate capacity
  if (config.capacityPerPlant !== undefined && config.capacityPerPlant <= 0) {
    errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_CAPACITY)
  }

  // Validate starting cash
  if (config.startingCash !== undefined && config.startingCash <= 0) {
    errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_CASH)
  }

  // Validate plant costs
  if (config.plantCostUS !== undefined && config.plantCostUS <= 0) {
    errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_PLANT_COST)
  }
  if (config.plantCostAsia !== undefined && config.plantCostAsia <= 0) {
    errors.push(SIMULATION_CONFIG.VALIDATION_MESSAGES.INVALID_PLANT_COST)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
