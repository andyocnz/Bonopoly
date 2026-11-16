import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameApi, authApi } from '../api/client'
import { useGame } from '../context/GameContext'
import {
  DEFAULT_COMPANY_NAMES,
  DEFAULT_DEMAND_MULTIPLIERS,
  DEFAULT_REGION_SPLIT,
  generateRandomGameName,
  getGameConfigForIndustry,
  TEAM_NAMES,
  INDUSTRIES
} from '../utils/gameCreationHelpers'



export function CreateGamePage() {
  const navigate = useNavigate()
  const { setGame, setIsEducator, isEducator, authReady } = useGame()
  const [adminChecked, setAdminChecked] = useState(false)
  const [adminAuthed, setAdminAuthed] = useState(false)

  useEffect(() => {
    if (!authReady) return

    const checkAuth = async () => {
      try {
        await authApi.me('admin')
        setAdminAuthed(true)
      } catch {
        // Redirect to admin login if not authenticated as admin
        setAdminAuthed(false)
        navigate('/modlab')
      } finally {
        setAdminChecked(true)
      }
    }
    checkAuth()
  }, [authReady, isEducator, navigate])

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdGame, setCreatedGame] = useState<{
    gameCode: string
    gamePin: string
    teams: Array<{ name: string; teamCode: string; teamPin: string; color: string; isComputer: boolean }>
  } | null>(null)

  // Game settings
  const [gameName, setGameName] = useState(generateRandomGameName())
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAMES['Oil & Energy'])
  const [companyNameTouched, setCompanyNameTouched] = useState(false)
  const [industry, setIndustry] = useState('Oil & Energy')
  const [totalRounds, setTotalRounds] = useState(3)
  const [hoursPerRound, setHoursPerRound] = useState<number | null>(null)
  const [marketDemandMode, setMarketDemandMode] = useState<'high_competition' | 'balanced' | 'blue_ocean'>('balanced')
  const [demandMultiplier, setDemandMultiplier] = useState(DEFAULT_DEMAND_MULTIPLIERS.balanced)
  const [regionDemandSplit, setRegionDemandSplit] = useState({ ...DEFAULT_REGION_SPLIT })
  const [showAdvancedDemand, setShowAdvancedDemand] = useState(false)
  const [capacityPerPlant, setCapacityPerPlant] = useState(
    getGameConfigForIndustry(industry).capacityPerPlant
  )
  const [capacityPerPlantTouched, setCapacityPerPlantTouched] = useState(false)
  const [timezone, setTimezone] = useState('Pacific/Auckland')
  const [regionLabels, setRegionLabels] = useState({ us: 'Americas', asia: 'Asia', europe: 'Europe' })
  const [showRegionLabels, setShowRegionLabels] = useState(false)
  const [showConfigPreview, setShowConfigPreview] = useState(false)
  const [teamCount, setTeamCount] = useState(4)
  const [teams, setTeams] = useState<Array<{ name: string; isAI: boolean; aiDifficulty: 'easy' | 'medium' | 'hard' }>>(
    TEAM_NAMES.slice(0, 4).map(name => ({ name, isAI: false, aiDifficulty: 'medium' }))
  )

  const handleTeamNameChange = (index: number, name: string) => {
    const newTeams = [...teams]
    newTeams[index] = { ...newTeams[index], name }
    setTeams(newTeams)
  }

  useEffect(() => {
    if (companyNameTouched) return
    setCompanyName(DEFAULT_COMPANY_NAMES[industry] || '')
  }, [industry, companyNameTouched])

  useEffect(() => {
    if (capacityPerPlantTouched) return
    setCapacityPerPlant(getGameConfigForIndustry(industry).capacityPerPlant)
  }, [industry, capacityPerPlantTouched])

  const handleTeamAIChange = (index: number, isAI: boolean) => {
    const newTeams = [...teams]
    newTeams[index] = { ...newTeams[index], isAI }
    setTeams(newTeams)
  }

  const handleTeamDifficultyChange = (index: number, difficulty: 'easy' | 'medium' | 'hard') => {
    const newTeams = [...teams]
    newTeams[index] = { ...newTeams[index], aiDifficulty: difficulty }
    setTeams(newTeams)
  }

  const handleTeamCountChange = (count: number) => {
    setTeamCount(count)
    const newTeams = [...teams]
    while (newTeams.length < count) {
      newTeams.push({ name: TEAM_NAMES[newTeams.length] || `Team ${newTeams.length + 1}`, isAI: false, aiDifficulty: 'medium' })
    }
    setTeams(newTeams.slice(0, count))
  }

  const configPreview = JSON.stringify(getGameConfigForIndustry(industry, { capacityPerPlant }), null, 2)

  const handleCreateGame = async () => {
    if (!gameName.trim()) {
      setError('Game name is required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const result = await gameApi.create({
        name: gameName || undefined,
        companyName,
        industry,
        totalRounds,
        hoursPerRound: hoursPerRound ?? undefined,
        marketDemandMode,
        marketDemandMultiplier: demandMultiplier,
        regionDemandSplit,
        capacityPerFactory: capacityPerPlant,
        timezone,
        regionLabels,
        teams: teams.slice(0, teamCount).map(t => ({
          name: t.name,
          isAI: t.isAI,
          aiDifficulty: t.isAI ? t.aiDifficulty : undefined,
        })),
      })

      setCreatedGame({
        gameCode: result.game.gameCode,
        gamePin: result.game.gamePin,
        teams: result.game.teams.map((t) => ({
          name: t.name,
          teamCode: t.teamCode,
          teamPin: t.teamPin,
          color: t.color,
          isComputer: t.isComputer,
        })),
      })
      const gameWithCapacity = result.game as typeof result.game & { capacityPerFactory?: number }

      setGame({
        id: result.game.id,
        gameCode: result.game.gameCode,
        name: result.game.name,
        status: result.game.status,
        companyName,
        industry,
        totalRounds,
        currentRound: result.game.currentRound,
        roundDeadline: result.game.roundDeadline,
        timezone: result.game.timezone,
        regionLabels: result.game.regionLabels ?? regionLabels,
        scenarioSequence: [],
        marketDemandMode,
        marketDemandMultiplier: demandMultiplier,
        teams: result.game.teams, // Include all teams!
        capacityPerFactory: gameWithCapacity.capacityPerFactory ?? capacityPerPlant,
      })
      setIsEducator(true)

      setStep(3)
      setStep(3)
      navigate('/admin-game')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
    } finally {
      setLoading(false)
    }
  }


  if (!authReady || !adminChecked) {
    return (
      <div className="create-page">
        <div className="create-container">
          <div className="loading-message">Checking admin session...</div>
        </div>
      </div>
    )
  }

  if (!adminAuthed) {
    return null
  }

  return (
    <div className="create-page">
      <div className="create-container">
        <button className="back-btn" onClick={() => navigate('/modlab')}>
          &larr; Back to Modlab
        </button>

        <h1>Create New Game</h1>

        {/* Step indicators */}
        <div className="steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Settings</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Teams</span>
          </div>
          <div className="step-line" />
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Ready</span>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Step 1: Game Settings */}
        {step === 1 && (
          <div className="step-content">
            <div className="form-group">
              <label>Game Name</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., Marketing 101 - Fall 2024"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyNameTouched(true)
                    setCompanyName(e.target.value)
                  }}
                  placeholder="TechCorp"
                />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  {INDUSTRIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Rounds</label>
                <select
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} Rounds</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Time per Round</label>
                <select
                  value={hoursPerRound ?? 0}
                  onChange={(e) =>
                    setHoursPerRound(
                      Number(e.target.value) || null
                    )
                  }
                >
                  <option value={0}>No time limit</option>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={24}>1 day</option>
                  <option value={48}>2 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Number of Teams</label>
                <select
                  value={teamCount}
                  onChange={(e) => handleTeamCountChange(Number(e.target.value))}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} Teams
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Market Demand Mode</label>
                <select
                  value={marketDemandMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'high_competition' | 'balanced' | 'blue_ocean'
                    setMarketDemandMode(mode)
                    setDemandMultiplier(DEFAULT_DEMAND_MULTIPLIERS[mode])
                  }}
                >
                  <option value="high_competition">High Competition (lower growth)</option>
                  <option value="balanced">Balanced (default)</option>
                  <option value="blue_ocean">Blue Ocean (higher growth)</option>
                </select>
              </div>
            </div>

            <div className="form-group collapsible">
              <button
                type="button"
                className="collapse-header"
                onClick={() => setShowAdvancedDemand((prev) => !prev)}
              >
                <span>Advanced Demand Settings</span>
                <span className={`collapse-icon ${showAdvancedDemand ? 'open' : ''}`}>▾</span>
              </button>
              {showAdvancedDemand && (
                <div className="collapse-body">
                  <div className="form-group">
                    <label>Capacity Per Plant (units)</label>
                    <input
                      type="number"
                      min="100000"
                      step="10000"
                      value={capacityPerPlant}
                      onChange={(e) => {
                        setCapacityPerPlantTouched(true)
                        const next = Number(e.target.value)
                        if (!Number.isFinite(next)) return
                        setCapacityPerPlant(Math.max(0, Math.round(next)))
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Scenario Growth Amplifier: {demandMultiplier.toFixed(2)}x
                      <span className="hint">
                        {marketDemandMode === 'balanced' && ' (2.0 = doubles scenario growth rates)'}
                        {marketDemandMode === 'blue_ocean' && ' (3.0 = faster market expansion)'}
                        {marketDemandMode === 'high_competition' && ' (1.0 = base scenario growth)'}
                      </span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.05"
                      value={demandMultiplier}
                      onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="region-split-section">
                    <label>Region Demand Split (must sum to 100%)</label>
                    <div className="region-split-grid">
                      <div className="form-group">
                        <label>Americas: {(regionDemandSplit.us * 100).toFixed(0)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={regionDemandSplit.us * 100}
                          onChange={(e) => {
                            const newUs = parseFloat(e.target.value) / 100
                            const remaining = 1 - newUs
                            const ratio = regionDemandSplit.asia / (regionDemandSplit.asia + regionDemandSplit.europe) || 0.5
                            setRegionDemandSplit({
                              us: newUs,
                              asia: remaining * ratio,
                              europe: remaining * (1 - ratio),
                            })
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Asia: {(regionDemandSplit.asia * 100).toFixed(0)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={regionDemandSplit.asia * 100}
                          onChange={(e) => {
                            const newAsia = parseFloat(e.target.value) / 100
                            const remaining = 1 - newAsia
                            const ratio = regionDemandSplit.us / (regionDemandSplit.us + regionDemandSplit.europe) || 0.5
                            setRegionDemandSplit({
                              us: remaining * ratio,
                              asia: newAsia,
                              europe: remaining * (1 - ratio),
                            })
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Europe: {(regionDemandSplit.europe * 100).toFixed(0)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={regionDemandSplit.europe * 100}
                          onChange={(e) => {
                            const newEurope = parseFloat(e.target.value) / 100
                            const remaining = 1 - newEurope
                            const ratio = regionDemandSplit.us / (regionDemandSplit.us + regionDemandSplit.asia) || 0.5
                            setRegionDemandSplit({
                              us: remaining * ratio,
                              asia: remaining * (1 - ratio),
                              europe: newEurope,
                            })
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setRegionDemandSplit({ ...DEFAULT_REGION_SPLIT })}
                    >
                      Reset to Default (22/60/18)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="Pacific/Auckland">Pacific/Auckland (NZ)</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
            </div>

            <div className="form-group collapsible">
              <button
                type="button"
                className="collapse-header"
                onClick={() => setShowRegionLabels((prev) => !prev)}
              >
                <span>Region Labels (optional)</span>
                <span className={`collapse-icon ${showRegionLabels ? 'open' : ''}`}>▾</span>
              </button>
              {showRegionLabels && (
                <div className="collapse-body">
                  <div className="region-labels-grid">
                    <div className="form-group">
                      <label>Region Label (Americas)</label>
                      <input
                        type="text"
                        value={regionLabels.us}
                        onChange={(e) => setRegionLabels((prev) => ({ ...prev, us: e.target.value }))}
                        placeholder="Americas"
                      />
                    </div>
                    <div className="form-group">
                      <label>Region Label (Asia)</label>
                      <input
                        type="text"
                        value={regionLabels.asia}
                        onChange={(e) => setRegionLabels((prev) => ({ ...prev, asia: e.target.value }))}
                        placeholder="Asia"
                      />
                    </div>
                    <div className="form-group">
                      <label>Region Label (Europe)</label>
                      <input
                        type="text"
                        value={regionLabels.europe}
                        onChange={(e) => setRegionLabels((prev) => ({ ...prev, europe: e.target.value }))}
                        placeholder="Europe"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group collapsible">
              <button
                type="button"
                className="collapse-header"
                onClick={() => setShowConfigPreview((prev) => !prev)}
              >
                <span>Game Config Preview</span>
                <span className={`collapse-icon ${showConfigPreview ? 'open' : ''}`}>▾</span>
              </button>
              {showConfigPreview && (
                <div className="collapse-body">
                  <div className="config-preview">
                    <div className="config-preview-title">Config used for {industry}</div>
                    <pre>{configPreview}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="button-row">
              <button className="btn-secondary" onClick={() => navigate('/modlab')}>
                &larr; Back to Modlab
              </button>
              <button className="btn-primary" onClick={() => setStep(2)}>
                Continue &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Team Setup */}
        {step === 2 && (
          <div className="step-content">
            <div className="teams-grid">
              {teams.slice(0, teamCount).map((team, i) => (
                <div key={i} className={`team-input ${team.isAI ? 'is-ai' : ''}`}>
                  <span className="team-number">{i + 1}</span>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => handleTeamNameChange(i, e.target.value)}
                    placeholder={`Team ${i + 1}`}
                  />
                  <label className="ai-toggle" title="Computer AI">
                    <input
                      type="checkbox"
                      checked={team.isAI}
                      onChange={(e) => handleTeamAIChange(i, e.target.checked)}
                    />
                    <span className="ai-label">AI</span>
                  </label>
                  {team.isAI && (
                    <div className="difficulty-picker">
                      <button
                        type="button"
                        className={`diff-btn ${team.aiDifficulty === 'easy' ? 'active' : ''}`}
                        onClick={() => handleTeamDifficultyChange(i, 'easy')}
                        title="Easy - Makes mistakes"
                      >
                        🟢
                      </button>
                      <button
                        type="button"
                        className={`diff-btn ${team.aiDifficulty === 'medium' ? 'active' : ''}`}
                        onClick={() => handleTeamDifficultyChange(i, 'medium')}
                        title="Medium - Balanced"
                      >
                        🟡
                      </button>
                      <button
                        type="button"
                        className={`diff-btn ${team.aiDifficulty === 'hard' ? 'active' : ''}`}
                        onClick={() => handleTeamDifficultyChange(i, 'hard')}
                        title="Hard - Expert"
                      >
                        🔴
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="hint">Check "AI" to make a team computer-controlled. Each AI gets a unique personality!</p>

            <div className="button-row">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                &larr; Back
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateGame}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Game Created */}
        {step === 3 && createdGame && (
          <div className="step-content success-step">
            <div className="success-icon">&#10003;</div>
            <h2>Game Created!</h2>

            <div className="game-code-display">
              <div className="code-row">
                <div className="code-item">
                  <span className="code-label">Game Code</span>
                  <span className="code-value">{createdGame.gameCode}</span>
                </div>
                <div className="code-item">
                  <span className="code-label">Game PIN</span>
                  <span className="code-value pin">{createdGame.gamePin}</span>
                </div>
              </div>
              <p className="hint" style={{ marginTop: '1rem', textAlign: 'center' }}>
                Use these credentials to manage your game as an educator
              </p>
            </div>

            <div className="team-codes">
              <h3>Team Login Codes</h3>
              <p className="hint">Share these codes with your teams</p>
              <div className="team-list">
                {createdGame.teams.map((team) => (
                  <div
                    key={team.teamCode}
                    className={`team-row ${team.isComputer ? 'is-ai' : ''}`}
                    style={{ borderLeftColor: team.color }}
                  >
                    <div className="team-name-wrapper">
                      <span className="team-name">{team.name}</span>
                      {team.isComputer && <span className="ai-badge">AI</span>}
                    </div>
                    {team.isComputer ? (
                      <span className="team-code ai-note">Auto-controlled</span>
                    ) : (
                      <div className="team-credentials">
                        <span className="team-code">{team.teamCode}</span>
                        <span className="team-pin">PIN: {team.teamPin}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={() => {
                navigate('/educator-dev')
              }}
            >
              Go to Educator Dashboard
            </button>
          </div>
        )}
      </div>

      <style>{`
        .create-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          padding: 2rem;
        }

        .create-container {
          max-width: 600px;
          margin: 0 auto;
        }

        .back-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 1rem;
          cursor: pointer;
          padding: 0.5rem 0;
          margin-bottom: 1rem;
        }

        .back-btn:hover {
          color: #fff;
        }

        h1 {
          color: #fff;
          font-size: 2rem;
          margin: 0 0 2rem 0;
        }

        .steps {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0.4;
        }

        .step.active {
          opacity: 1;
        }

        .step-number {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .step.active .step-number {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a2e;
        }

        .step-label {
          color: #94a3b8;
          font-size: 0.75rem;
        }

        .step-line {
          width: 60px;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0 1rem;
          margin-bottom: 1.5rem;
        }

        .step-content {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: #fff;
          font-size: 1rem;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4facfe;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .collapsible {
          margin-top: 0.75rem;
        }

        .collapse-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .collapse-header:hover {
          border-color: rgba(56, 189, 248, 0.5);
          background: rgba(15, 23, 42, 0.75);
        }

        .collapse-icon {
          display: inline-flex;
          transition: transform 0.2s ease;
          color: #94a3b8;
        }

        .collapse-icon.open {
          transform: rotate(180deg);
          color: #7dd3fc;
        }

        .collapse-body {
          margin-top: 0.75rem;
        }

        .region-labels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 0.75rem;
        }

        .config-preview {
          margin-top: 0.75rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          padding: 0.75rem;
        }

        .config-preview-title {
          color: #94a3b8;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }

        .config-preview pre {
          margin: 0;
          max-height: 240px;
          overflow: auto;
          font-size: 0.72rem;
          color: #e2e8f0;
          line-height: 1.4;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #fff;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 20px;
          height: 20px;
        }

        .hint {
          color: #64748b;
          font-size: 0.8rem;
          margin: 0.5rem 0 0 0;
        }

        .teams-grid {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .team-input {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .team-number {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-weight: 600;
          flex-shrink: 0;
        }

        .team-input input[type="text"] {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: #fff;
        }

        .team-input.is-ai {
          background: rgba(79, 172, 254, 0.05);
          border-radius: 8px;
          padding: 0.5rem;
          margin: -0.5rem;
        }

        .ai-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s ease;
        }

        .ai-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .ai-toggle input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .ai-toggle input[type="checkbox"]:checked + .ai-label {
          color: #4facfe;
        }

        .ai-label {
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .button-row {
          display: flex;
          gap: 1rem;
        }

        .btn-primary {
          flex: 1;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a2e;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          padding: 1rem 2rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-size: 1rem;
          cursor: pointer;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .success-step {
          text-align: center;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          color: #fff;
          font-size: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }

        .success-step h2 {
          color: #fff;
          margin: 0 0 2rem 0;
        }

        .game-code-display {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .code-row {
          display: flex;
          justify-content: center;
          gap: 3rem;
        }

        .code-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .code-label {
          display: block;
          color: #64748b;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .code-value {
          font-size: 2rem;
          font-weight: 700;
          color: #4facfe;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.1em;
        }

        .code-value.pin {
          color: #10b981;
        }

        .team-codes h3 {
          color: #fff;
          font-size: 1rem;
          margin: 0 0 0.25rem 0;
        }

        .team-list {
          margin-top: 1rem;
          text-align: left;
        }

        .team-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          margin-bottom: 0.5rem;
          border-left: 4px solid;
        }

        .team-row.is-ai {
          background: rgba(79, 172, 254, 0.1);
        }

        .team-name-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .team-name {
          color: #fff;
        }

        .ai-badge {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: #1a1a2e;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .team-credentials {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
        }

        .team-code {
          font-family: 'JetBrains Mono', monospace;
          color: #4facfe;
          font-size: 0.9rem;
        }

        .team-pin {
          font-family: 'JetBrains Mono', monospace;
          color: #10b981;
          font-size: 0.8rem;
        }

        .team-code.ai-note {
          color: #64748b;
          font-family: inherit;
          font-style: italic;
        }

        /* Inline Difficulty Picker */
        .difficulty-picker {
          display: flex;
          gap: 0.25rem;
          margin-left: 0.5rem;
        }

        .diff-btn {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.3);
          cursor: pointer;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        }

        .diff-btn:hover {
          background: rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .diff-btn.active {
          border-color: #4facfe;
          background: rgba(79, 172, 254, 0.2);
          box-shadow: 0 0 8px rgba(79, 172, 254, 0.4);
        }
      `}</style>
    </div>
  )
}
