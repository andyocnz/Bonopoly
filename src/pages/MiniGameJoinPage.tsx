import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MiniGameTypeSlug } from '../api/client'
import { miniGamesApi } from '../api/client'
import './MiniGameJoinPage.css'

async function probeGameTypeByRoomCode(roomCode: string): Promise<MiniGameTypeSlug | null> {
  const probes: Array<{ gameType: MiniGameTypeSlug; path: string }> = [
    { gameType: 'bank-run', path: `/api/minigames/bank-run/${roomCode}/state` },
    { gameType: 'fishery', path: `/api/minigames/fishery/${roomCode}/state` },
    { gameType: 'double-auction', path: `/api/minigames/double-auction/${roomCode}/state` },
    { gameType: 'prisoners-dilemma', path: `/api/minigames/prisoners-dilemma/${roomCode}/state` },
    { gameType: 'matching-pennies', path: `/api/minigames/matching-pennies/${roomCode}/state` },
    { gameType: 'ultimatum', path: `/api/minigames/ultimatum/${roomCode}/state` },
    { gameType: 'trust-game', path: `/api/minigames/trust-game/${roomCode}/state` },
    { gameType: 'public-goods', path: `/api/minigames/public-goods/${roomCode}/state` },
    { gameType: 'cournot', path: `/api/minigames/cournot/${roomCode}/state` },
    { gameType: 'bertrand', path: `/api/minigames/bertrand/${roomCode}/state` },
    { gameType: 'english-auction', path: `/api/minigames/english-auction/${roomCode}/state` },
    { gameType: 'beauty-contest', path: `/api/minigames/beauty-contest/${roomCode}/state` },
    { gameType: 'monte-carlo-pi', path: `/api/minigames/monte-carlo-pi/${roomCode}/state` },
    { gameType: 'market-survival', path: `/api/minigames/market-survival/${roomCode}/state` },
    { gameType: 'portfolio-frontier', path: `/api/minigames/portfolio-frontier/${roomCode}/state` },
    { gameType: 'adverse-selection', path: `/api/minigames/adverse-selection/${roomCode}/state` },
    { gameType: 'signaling-game', path: `/api/minigames/signaling-game/${roomCode}/state` },
    { gameType: 'principal-agent', path: `/api/minigames/principal-agent/${roomCode}/state` },
    { gameType: 'monopoly-pricing', path: `/api/minigames/monopoly-pricing/${roomCode}/state` },
    { gameType: 'asset-bubble', path: `/api/minigames/asset-bubble/${roomCode}/state` },
    { gameType: 'conflict-of-interest', path: `/api/minigames/conflict-of-interest/${roomCode}/state` },
    { gameType: 'ad-auction', path: `/api/minigames/ad-auction/${roomCode}/state` },
    { gameType: 'director-duties', path: `/api/minigames/director-duties/${roomCode}/state` },
    { gameType: 'social-influence', path: `/api/minigames/social-influence/${roomCode}/state` },
    { gameType: 'crypto-bubble', path: `/api/minigames/crypto-bubble/${roomCode}/state` },
  ]

  for (const probe of probes) {
    try {
      const response = await fetch(probe.path, { credentials: 'include' })
      if (response.ok) {
        return probe.gameType
      }
    } catch {
      // Continue probing next game type.
    }
  }
  return null
}

export default function MiniGameJoinPage() {
  const navigate = useNavigate()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const [roomCode, setRoomCode] = useState((query.get('code') || '').trim().toUpperCase())
  const [name, setName] = useState((query.get('name') || '').trim())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase()
    if (!code) {
      setError('Enter a game code')
      return
    }

    setLoading(true)
    setError('')
    try {
      let gameType: MiniGameTypeSlug | null = null
      try {
        const response = await miniGamesApi.resolveRoomCode(code)
        gameType = response.room.gameType
      } catch {
        gameType = await probeGameTypeByRoomCode(code)
      }
      if (!gameType) {
        throw new Error('Game code not found')
      }
      const params = new URLSearchParams()
      params.set('room', code)
      if (name.trim()) {
        params.set('name', name.trim())
      }
      navigate(`/mini-games/${gameType}?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to find this code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mini-join-page">
      <section className="mini-join-card">
        <h1>Join Mini-Game</h1>
        <p>Enter the game code from your educator.</p>

        <label htmlFor="room-code">Game Code</label>
        <input
          id="room-code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="e.g. A7K4Q2"
          maxLength={12}
        />

        <label htmlFor="display-name">Your Name</label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
        />

        {error && <div className="mini-join-error">{error}</div>}

        <button type="button" disabled={loading} onClick={() => void handleJoin()}>
          {loading ? 'Joining...' : 'Join Game'}
        </button>
      </section>
    </main>
  )
}
