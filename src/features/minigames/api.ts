import { educatorApi } from '../../api/client'
import type { EducatorMiniGameSession } from '../../api/client'
import type { EducatorMiniGamePlayer } from '../../api/client'

export const educatorMiniGamesApi = {
  listSessions: async (): Promise<EducatorMiniGameSession[]> => {
    const { sessions } = await educatorApi.listMiniGameSessions()
    return sessions
  },
  createSession: (payload: {
    gameType: EducatorMiniGameSession['gameType']
    teamCount?: number
    title?: string
    roomCode?: string
    configJson?: Record<string, unknown>
  }) => educatorApi.createMiniGameSession(payload),
  getSessionLinks: (sessionId: string) => educatorApi.getMiniGameSessionLinks(sessionId),
  getSessionPlayers: async (sessionId: string): Promise<EducatorMiniGamePlayer[]> => {
    const { players } = await educatorApi.getMiniGameSessionPlayers(sessionId)
    return players
  },
  hostAction: (sessionId: string, action: 'start' | 'advance' | 'reset') =>
    educatorApi.runMiniGameHostAction(sessionId, action),
}
