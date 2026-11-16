import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { TeamNavBar } from '../components/TeamNavBar'

// Scenario definitions
const SCENARIOS = {
  0: {
    name: 'Stable Market',
    subtitle: 'Business as usual',
    icon: '&#128200;',
    description:
      'The global economy continues its steady growth. Consumer confidence is stable, and competition remains predictable. Focus on operational efficiency and maintaining your market position.',
    marketConditions: [
      { region: 'US', demand: 'Stable (+0%)', trend: 'neutral' },
      { region: 'Asia', demand: 'Stable (+0%)', trend: 'neutral' },
      { region: 'Europe', demand: 'Stable (+0%)', trend: 'neutral' },
    ],
    recommendations: [
      'Maintain current production levels',
      'Focus on cost optimization',
      'Steady marketing investments',
    ],
  },
  1: {
    name: 'Asia Boom',
    subtitle: 'Eastern markets surge',
    icon: '&#127757;',
    description:
      'Rapid economic growth in Asian markets is driving unprecedented demand. Rising middle class consumers are eager for premium products. However, Western markets may see reduced growth.',
    marketConditions: [
      { region: 'US', demand: 'Stable (+0%)', trend: 'neutral' },
      { region: 'Asia', demand: 'Surge (+15%)', trend: 'up' },
      { region: 'Europe', demand: 'Declining (-5%)', trend: 'down' },
    ],
    recommendations: [
      'Increase Asian market focus',
      'Consider Asia manufacturing expansion',
      'Redistribute marketing budget to Asia',
    ],
  },
  2: {
    name: 'Green Wave',
    subtitle: 'Sustainability matters',
    icon: '&#127793;',
    description:
      'Environmental consciousness is reshaping consumer preferences worldwide. Companies with strong CSR initiatives and sustainable practices are seeing increased customer loyalty and market share.',
    marketConditions: [
      { region: 'US', demand: 'Growing (+5%)', trend: 'up' },
      { region: 'Asia', demand: 'Stable (+0%)', trend: 'neutral' },
      { region: 'Europe', demand: 'Growing (+10%)', trend: 'up' },
    ],
    recommendations: [
      'Invest heavily in CSR initiatives',
      'Highlight sustainability in marketing',
      'Consider R&D for eco-friendly products',
    ],
  },
  3: {
    name: 'Price War',
    subtitle: 'Competition intensifies',
    icon: '&#9876;',
    description:
      'Aggressive competitor pricing is putting pressure on margins across all markets. Customers are highly price-sensitive, and brand loyalty is being tested. Strategic pricing decisions are critical.',
    marketConditions: [
      { region: 'US', demand: 'Declining (-10%)', trend: 'down' },
      { region: 'Asia', demand: 'Declining (-5%)', trend: 'down' },
      { region: 'Europe', demand: 'Declining (-15%)', trend: 'down' },
    ],
    recommendations: [
      'Review pricing strategy carefully',
      'Focus on cost reduction',
      'Strengthen brand value proposition',
    ],
  },
} as const

function useTypewriter(text: string, speed: number = 20) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1))
        i++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayedText, isComplete }
}

export function ScenarioPage() {
  const navigate = useNavigate()
  const { game, authReady } = useGame()
  const [showDetails, setShowDetails] = useState(false)

  const currentRound = game?.currentRound ?? 0
  const scenarioId = game?.scenarioSequence?.[currentRound] ?? 0
  const scenario = SCENARIOS[scenarioId as keyof typeof SCENARIOS] || SCENARIOS[0]

  const { displayedText, isComplete } = useTypewriter(scenario.description, 15)

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setShowDetails(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isComplete])

  useEffect(() => {
    if (!authReady) return
    if (!game) {
      navigate('/')
    }
  }, [authReady, game, navigate])

  if (!authReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#64748b',
        fontSize: '1rem'
      }}>
        Restoring session...
      </div>
    )
  }

  if (!game) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#64748b',
        fontSize: '1rem'
      }}>
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="scenario-page">
      <TeamNavBar />

      <main className="scenario-main">
        <div className="scenario-card">
          <div className="scenario-icon" dangerouslySetInnerHTML={{ __html: scenario.icon }} />
          <h1 className="scenario-name">{scenario.name}</h1>
          <p className="scenario-subtitle">{scenario.subtitle}</p>
        </div>

        <div className="briefing-section">
          <h2>Intelligence Briefing</h2>
          <div className="briefing-text">
            <span className="cursor-prompt">&gt;</span> {displayedText}
            {!isComplete && <span className="cursor">|</span>}
          </div>
        </div>

        {showDetails && (
          <>
            <div className="market-section fade-in">
              <h2>Market Conditions</h2>
              <div className="market-grid">
                {scenario.marketConditions.map((mc) => (
                  <div key={mc.region} className={`market-card ${mc.trend}`}>
                    <span className="region-name">{mc.region}</span>
                    <span className="demand-value">{mc.demand}</span>
                    <div className={`trend-indicator ${mc.trend}`}>
                      {mc.trend === 'up' && '&#9650;'}
                      {mc.trend === 'down' && '&#9660;'}
                      {mc.trend === 'neutral' && '&#9644;'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="recommendations-section fade-in">
              <h2>Strategic Recommendations</h2>
              <ul className="recommendations-list">
                {scenario.recommendations.map((rec, i) => (
                  <li key={i} className="fade-in" style={{ animationDelay: `${i * 0.2}s` }}>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            <div className="action-section fade-in">
              <button
                className="btn-primary"
                onClick={() => navigate('/decisions')}
              >
                Proceed to Decisions &rarr;
              </button>
            </div>
          </>
        )}
      </main>

      <style>{`
        .scenario-page {
          min-height: 100vh;
          background: var(--bg-page);
          font-family: var(--font-main);
          color: var(--text-primary);
        }

        .scenario-main {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 2rem;
        }

        .scenario-card {
          text-align: center;
          margin-bottom: 3rem;
        }

        .scenario-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .scenario-name {
          color: var(--text-primary);
          font-size: 2.5rem;
          margin: 0;
          font-weight: 700;
          font-family: var(--font-heading);
        }

        .scenario-subtitle {
          color: var(--text-muted);
          font-size: 1.25rem;
          margin: 0.5rem 0 0 0;
        }

        .briefing-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow-card);
        }

        .briefing-section h2 {
          color: var(--text-muted);
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 1rem 0;
        }

        .briefing-text {
          color: var(--text-primary);
          font-size: 1.125rem;
          line-height: 1.8;
          font-family: var(--font-mono);
        }

        .cursor-prompt {
          color: var(--text-accent);
          margin-right: 0.5rem;
        }

        .cursor {
          color: var(--text-accent);
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .market-section {
          margin-bottom: 2rem;
        }

        .market-section h2,
        .recommendations-section h2 {
          color: var(--text-primary);
          font-size: 1.25rem;
          margin: 0 0 1rem 0;
          font-family: var(--font-heading);
        }

        .market-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .market-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          padding: 1.5rem;
          text-align: center;
          box-shadow: var(--shadow-card);
        }

        .market-card.up {
          border-color: var(--color-success);
          background: var(--bg-card);
        }

        .market-card.down {
          border-color: var(--color-danger);
          background: var(--bg-card);
        }

        .region-name {
          display: block;
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .demand-value {
          display: block;
          color: var(--text-primary);
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .trend-indicator {
          font-size: 1.25rem;
        }

        .trend-indicator.up {
          color: var(--color-success);
        }

        .trend-indicator.down {
          color: var(--color-danger);
        }

        .trend-indicator.neutral {
          color: var(--text-muted);
        }

        .recommendations-section {
          margin-bottom: 3rem;
        }

        .recommendations-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recommendations-list li {
          color: var(--text-primary);
          padding: 1rem;
          background: var(--bg-card);
          border-left: 4px solid var(--text-accent);
          margin-bottom: 0.5rem;
          border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
          box-shadow: var(--shadow-card);
        }

        .action-section {
          text-align: center;
        }

        .btn-primary {
          background: var(--text-accent);
          border: none;
          color: #fff;
          font-size: 1.125rem;
          font-weight: 600;
          padding: var(--btn-padding);
          border-radius: var(--btn-radius);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-glow);
        }

        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .market-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
