
import { GAME_CONFIG, INDUSTRY_CONFIGS, type GameConfig } from '../engine/gameEngine'

// Greek letter names for teams (up to 10)
export const TEAM_NAMES = [
    'Team Alpha',
    'Team Beta',
    'Team Gamma',
    'Team Delta',
    'Team Epsilon',
    'Team Zeta',
    'Team Eta',
    'Team Theta',
    'Team Iota',
    'Team Kappa',
]

// Random game name generation
const ADJECTIVES = ['Strategic', 'Dynamic', 'Innovative', 'Global', 'Competitive', 'Elite', 'Advanced', 'Premier', 'Master', 'Ultimate']
const NOUNS = ['Challenge', 'Venture', 'Summit', 'Quest', 'Arena', 'Showdown', 'Championship', 'League', 'Tournament', 'Competition']

export const INDUSTRIES = ['Oil & Energy', 'Electronics', 'Automotive']
export const DEFAULT_COMPANY_NAMES: Record<string, string> = {
    'Oil & Energy': 'PetroCore',
    Electronics: 'VoltWorks',
    Automotive: 'AutoForge',
}

export function generateRandomGameName(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    const number = Math.floor(Math.random() * 100) + 1
    return `${adjective} ${noun} ${number}`
}

// Default amplifiers for scenario growth by demand mode
// Balanced: 2.0x scenario growth (default)
// Blue Ocean: 3.0x scenario growth
// Competitive: 1.0x scenario growth
export const DEFAULT_DEMAND_MULTIPLIERS: Record<'high_competition' | 'balanced' | 'blue_ocean', number> = {
    high_competition: 1.0,
    balanced: 2.0,
    blue_ocean: 3.0,
}

// Default region demand split (must sum to 1.0)
export const DEFAULT_REGION_SPLIT = { us: 0.22, asia: 0.60, europe: 0.18 }

export function getGameConfigForIndustry(industry: string, overrides?: Partial<GameConfig>): GameConfig {
    const industryConfig = INDUSTRY_CONFIGS[industry]
    if (!industryConfig) return GAME_CONFIG

    // Simple deep merge for config
    const merged = JSON.parse(JSON.stringify(GAME_CONFIG))

    for (const [key, value] of Object.entries(industryConfig)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            merged[key] = { ...merged[key], ...value }
        } else {
            merged[key] = value
        }
    }

    if (overrides) {
        for (const [key, value] of Object.entries(overrides)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value }
            } else if (value !== undefined) {
                merged[key] = value
            }
        }
    }

    return merged
}
