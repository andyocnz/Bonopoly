import { useMemo, useState } from 'react'
import knowledgeBase from '../data/knowledgeBase.json'
import { useGame } from '../context/GameContext'
import './HelpWidget.css'

type KnowledgeItem = {
  id: string
  title: string
  keywords: string[]
  summary: string
  bullets: string[]
}

type TabType = 'theory' | 'diagnostics'

const TOPIC_LIMIT = 8

export function HelpWidget() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('theory')
  const [query, setQuery] = useState('')
  const { gameState, game } = useGame()

  const items = knowledgeBase as KnowledgeItem[]

  // AI Diagnostic Engine
  const diagnostics = useMemo(() => {
    if (!gameState || !game) return []

    const insights: { type: 'warning' | 'info' | 'success'; text: string; action: string }[] = []

    // 1. Liquidity Check
    if (gameState.cashBalance < 5000000) {
      insights.push({
        type: 'warning',
        text: 'Critical liquidity detected. Cash reserves below $5M threshold.',
        action: 'Consider long-term debt or share issuance in Finance tab.'
      })
    } else if (gameState.cashBalance > 80000000) {
      insights.push({
        type: 'success',
        text: 'Strong capital surplus. High cash drag detected.',
        action: 'Consider dividends or plant investment to improve ROCE.'
      })
    }

    // 2. Inventory Check
    if (gameState.inventory > 15000) {
      insights.push({
        type: 'info',
        text: 'Inventory levels exceeding optimal storage range.',
        action: 'Adjust regional pricing down by 5-8% to accelerate sales.'
      })
    }

    // 3. R&D / Tech Check
    if (gameState.unlockedTechLevel < 2 && game.currentRound > 3) {
      insights.push({
        type: 'warning',
        text: 'Technological stagnation risk. Competitors may be outputting Gen-2 features.',
        action: 'Increase Research Staff allocation in HR immediately.'
      })
    }

    // 4. Over-leverage check
    const totalEquity = (gameState.shareCapital || 0) + (gameState.retainedEarnings || 0)
    const debtRatio = totalEquity > 0 ? (gameState.longTermDebt / totalEquity) : 0
    if (debtRatio > 1.5) {
      insights.push({
        type: 'warning',
        text: 'High Solvency Risk. Debt-to-Equity ratio exceeds 1.5.',
        action: 'Prioritize debt repayment or pause capital investments.'
      })
    }

    // Default insight if everything is super healthy
    if (insights.length === 0) {
      insights.push({
        type: 'success',
        text: 'Operational metrics optimal. AIDL identifies no immediate structural threats.',
        action: 'Focus on aggressive promotion to maximize market share.'
      })
    }

    return insights
  }, [gameState, game])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) {
      return items.slice(0, TOPIC_LIMIT)
    }
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.summary,
        item.keywords.join(' ')
      ].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [items, query])

  return (
    <div className="help-widget">
      {!open && (
        <button className="help-button aidl-pulse" onClick={() => setOpen(true)}>
          <span className="aidl-icon">🧪</span> Lab Assistant
        </button>
      )}
      {open && (
        <div className="help-panel">
          <div className="help-header">
            <div className="help-title">AIDL Lab Assistant</div>
            <button className="help-close" onClick={() => setOpen(false)} aria-label="Close help">
              ×
            </button>
          </div>

          <div className="help-tabs">
            <button
              className={`help-tab ${activeTab === 'theory' ? 'active' : ''}`}
              onClick={() => setActiveTab('theory')}
            >
              Theory
            </button>
            <button
              className={`help-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              AI Diagnostics
            </button>
          </div>

          <div className="help-body">
            {activeTab === 'theory' ? (
              <>
                <div className="help-input-row">
                  <input
                    className="help-input"
                    placeholder="Search Lab Knowledge Base..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button className="help-clear" onClick={() => setQuery('')}>
                    Reset
                  </button>
                </div>
                <div className="help-section-title">
                  {query.trim() ? 'Search Results' : 'Core Frameworks'}
                </div>
                {results.length === 0 && (
                  <div className="help-empty">No matching theories in AIDL database.</div>
                )}
                {results.map((item) => (
                  <div key={item.id} className="help-result">
                    <h4>{item.title}</h4>
                    <p>{item.summary}</p>
                    {item.bullets.length > 0 && (
                      <ul>
                        {item.bullets.map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="diagnostics-view">
                <div className="aidl-disclaimer">
                  Strategic analysis engine active. Processing Game Round {game?.currentRound || 1} state...
                </div>
                {diagnostics.map((insight, idx) => (
                  <div key={idx} className={`diagnostic-card insight-${insight.type}`}>
                    <div className="insight-badge">{insight.type.toUpperCase()}</div>
                    <div className="insight-text">{insight.text}</div>
                    <div className="insight-action">
                      <strong>AIDL Recommend:</strong> {insight.action}
                    </div>
                  </div>
                ))}
                {!gameState && (
                  <div className="help-empty">
                    Waiting for real-time game state synchronization...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
