import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { educatorApi } from '../api/client'
import './TeamLoginPage.css'

export function EducatorLoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await educatorApi.login(email, pin)
            navigate('/educator-dashboard')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="team-login-page">
            <div className="login-container animate-slide">
                <div className="logo-hero">E</div>
                <h1 className="login-title">Educator lab</h1>
                <p className="login-subtitle">Manage Your Business Simulations</p>

                <div className="login-card">
                    <h2 className="card-title">Educator Login</h2>

                    <form onSubmit={handleLogin}>
                        <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="educator@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                autoFocus
                                style={{ marginBottom: 0 }}
                            />
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                                PIN
                            </label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="Your PIN"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                disabled={loading}
                                style={{ marginBottom: 0 }}
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Logging in...' : 'Access Dashboard →'}
                        </button>
                    </form>

                    <div className="divider">
                        <div className="divider-line"></div>
                        <span className="divider-text">Or</span>
                        <div className="divider-line"></div>
                    </div>

                    <button
                        className="btn btn-ghost"
                        onClick={() => navigate('/team-login')}
                    >
                        Team Login
                    </button>
                </div>

                <div className="footer-text">
                    Strategic Business Simulation Platform
                </div>
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
