import { getGameConfigForIndustry, type GameConfig } from '../../engine/gameEngine'

type ConfigCarrier = {
  industry?: string | null
  capacityPerFactory?: number | null
  gameConfig?: unknown | null
}

export function resolveGameConfig(game: ConfigCarrier): GameConfig {
  if (game?.gameConfig && typeof game.gameConfig === 'object') {
    return game.gameConfig as GameConfig
  }

  return getGameConfigForIndustry(
    game?.industry ?? undefined,
    game?.capacityPerFactory ? { capacityPerPlant: game.capacityPerFactory } : undefined
  )
}

