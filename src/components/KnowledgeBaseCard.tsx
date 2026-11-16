
import React, { useMemo, useState } from 'react'
import knowledgeBase from '../data/knowledgeBase.json'
import './HelpWidget.css' // Reuse existing styles for consistency

type KnowledgeItem = {
    id: string
    title: string
    keywords: string[]
    summary: string
    bullets: string[]
}

const TOPIC_LIMIT = 5

export const KnowledgeBaseCard: React.FC = () => {
    const [query, setQuery] = useState('')

    const items = knowledgeBase as KnowledgeItem[]

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
        <div id="knowledge-base" className="card">
            <div className="card-header">
                <h2 className="card-title">Knowledge Base</h2>
                <span className="card-subtitle-round">Search Terms & Calcs</span>
            </div>
            <div className="card-body">
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    <input
                        className="help-input"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                        placeholder="Search (e.g., TSR, ROE)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '0 12px',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: '0.85rem'
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="dm-scroll-themed" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '1225px', overflowY: 'auto', paddingRight: '4px' }}>
                    {results.length === 0 && (
                        <div className="help-empty" style={{ color: 'var(--text-muted)' }}>No matches found.</div>
                    )}
                    {results.map((item) => (
                        <div key={item.id} className="help-result" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</h4>
                            <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>{item.summary}</p>
                            {item.bullets.length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {item.bullets.map((bullet, idx) => (
                                        <li key={idx} style={{ marginBottom: '2px' }}>{bullet}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
