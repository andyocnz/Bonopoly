import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { teamApi } from '../api/client'
import { useGame } from '../context/GameContext'
import './TeamLoginPage.css'

export function TeamLoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { setTeam, setGame, setGameState, setIsEducator, authReady, team, game } = useGame()

    const [teamCode, setTeamCode] = useState('')
    const [teamPin, setTeamPin] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const autoLoginAttemptedRef = useRef(false)

    // Redirect if already logged in
    useEffect(() => {
        if (!authReady) return

        // If logged in as team
        if (team && game) {
            if (game.status === 'SETUP') {
                navigate('/waiting')
            } else {
                navigate('/mission')
            }
        }
    }, [authReady, game, team, navigate])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const queryTeamCode = (params.get('teamCode') || '').trim().toUpperCase()
        const queryTeamPin = (params.get('teamPin') || '').trim().replace(/\D/g, '')
        const shouldAutoLogin = params.get('autologin') === '1'

        if (queryTeamCode) setTeamCode(queryTeamCode)
        if (queryTeamPin) setTeamPin(queryTeamPin)

        if (!shouldAutoLogin || !queryTeamCode || !queryTeamPin || autoLoginAttemptedRef.current) {
            return
        }

        autoLoginAttemptedRef.current = true
        setLoading(true)
        setError('')
        teamApi.login(queryTeamCode, queryTeamPin)
            .then(({ team, game, currentState }) => {
                setTeam(team)
                setGame(game)
                setGameState(currentState as never)
                setIsEducator(false)
                if (game.status === 'SETUP') {
                    navigate('/waiting')
                } else {
                    navigate('/mission')
                }
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Login failed. Please check your Team Code and PIN.')
            })
            .finally(() => {
                setLoading(false)
            })
    }, [location.search, navigate, setGame, setGameState, setIsEducator, setTeam])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!teamCode.trim()) {
            setError('Please enter a Team Code')
            return
        }

        if (!teamPin.trim()) {
            setError('Please enter the Team PIN')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { team, game, currentState } = await teamApi.login(teamCode.trim(), teamPin.trim())
            setTeam(team)
            setGame(game)
            setGameState(currentState as never)
            setIsEducator(false)

            if (game.status === 'SETUP') {
                navigate('/waiting')
            } else {
                navigate('/mission')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed. Please check your Team Code and PIN.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="team-login-page">
            <div className="login-container animate-slide">
                <div className="logo-hero">🤖</div>
                <h1 className="login-title">AI Decision Lab</h1>
                <p className="login-subtitle">Global Business Strategy Simulation</p>

                <div className="login-card">
                    <h2 className="card-title">Join Your Team</h2>

                    <form onSubmit={handleLogin}>
                        <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                                Team Code
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. ALPHA-A7X"
                                value={teamCode}
                                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                                disabled={loading}
                                autoFocus
                                style={{ marginBottom: 0 }}
                            />
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                                Team PIN
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={4}
                                className="input-field"
                                placeholder="4-digit PIN"
                                value={teamPin}
                                onChange={(e) => setTeamPin(e.target.value.replace(/\D/g, ''))}
                                disabled={loading}
                                style={{ marginBottom: 0 }}
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Entering Simulation...' : 'Enter Simulation →'}
                        </button>
                    </form>

                    <div className="divider">
                        <div className="divider-line"></div>
                        <span className="divider-text">Or</span>
                        <div className="divider-line"></div>
                    </div>

                    <button
                        className="btn btn-ghost"
                        onClick={() => navigate('/educator-login')}
                    >
                        Educator Login
                    </button>
                </div>

                <p className="footer-text">
                    &copy; 2026 AI Decision Lab. All rights reserved.
                </p>
                <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => window.location.href = '/'}
                >
                    Back
                </button>
            </div>
        </div>
    )
}
