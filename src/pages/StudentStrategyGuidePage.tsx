import { useEffect, useState, type ChangeEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { StrategyContext } from '../engine/strategyEngine'
import { runStudentStrategyInWorkerDetailed } from '../engine/studentStrategyRuntime'
import { parseStudentStrategyFile, type ParsedStudentStrategy } from '../engine/studentStrategyParser'

export default function StudentStrategyGuidePage() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadedStrategies, setUploadedStrategies] = useState<ParsedStudentStrategy[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [testingStrategyId, setTestingStrategyId] = useState<string | null>(null)
  const [strategyTestResults, setStrategyTestResults] = useState<Record<string, { ok: boolean; runtimeMs: number; output: unknown; message: string }>>({})

  useEffect(() => {
    let mounted = true
    fetch('/strategy-lab/Strategy_Lab_Student_Guide.md')
      .then((response) => response.text())
      .then((text) => {
        if (mounted) {
          setContent(text)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setContent('Unable to load guide. Please try again later.')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const errors: string[] = []
    const parsedItems: ParsedStudentStrategy[] = []

    for (const file of Array.from(files as FileList)) {
      try {
        const parsed = await parseStudentStrategyFile(file)
        parsedItems.push(parsed)
      } catch (error) {
        const fileName = (file as File).name || 'uploaded file'
        errors.push(error instanceof Error ? error.message : `Failed to parse ${fileName}`)
      }
    }

    if (parsedItems.length > 0) {
      setUploadedStrategies((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        parsedItems.forEach((item) => map.set(item.id, item))
        return Array.from(map.values())
      })
    }

    setUploadErrors(errors)
    event.target.value = ''
  }

  const buildDryRunContext = (): StrategyContext => ({
    round: 3,
    totalRounds: 20,
    scenarioId: 1,
    myTeam: {
      id: 1,
      name: 'Team Alpha',
      cash: 25_000_000,
      debt: 8_000_000,
      sharePrice: 126,
      marketCap: 126_000_000,
      factories: { us: 1, asia: 1 },
      inventory: { us: 14000, asia: 18000 },
      production: { us: 120000, asia: 140000 },
      marketShare: { us: 0.24, asia: 0.22, europe: 0.2 },
      sales: { us: 110000, asia: 130000, europe: 90000 },
      prices: { us: 126, asia: 112, europe: 131 },
    },
    competitors: [
      {
        id: 2,
        name: 'Team Beta',
        cash: 20_000_000,
        debt: 10_000_000,
        sharePrice: 118,
        marketCap: 118_000_000,
        factories: { us: 1, asia: 1 },
        inventory: { us: 12000, asia: 22000 },
        production: { us: 115000, asia: 145000 },
        marketShare: { us: 0.23, asia: 0.25, europe: 0.21 },
        sales: { us: 108000, asia: 136000, europe: 94000 },
        prices: { us: 121, asia: 108, europe: 127 },
        previousPrices: { us: 124, asia: 110, europe: 129 },
      },
      {
        id: 3,
        name: 'Team Gamma',
        cash: 31_000_000,
        debt: 5_000_000,
        sharePrice: 134,
        marketCap: 134_000_000,
        factories: { us: 2, asia: 1 },
        inventory: { us: 19000, asia: 9000 },
        production: { us: 150000, asia: 100000 },
        marketShare: { us: 0.27, asia: 0.18, europe: 0.23 },
        sales: { us: 123000, asia: 97000, europe: 98000 },
        prices: { us: 132, asia: 118, europe: 136 },
        previousPrices: { us: 130, asia: 116, europe: 134 },
      }
    ],
    marketData: {
      avgPrice: { us: 126, asia: 112, europe: 131 },
      avgMarketShare: 0.25,
      totalDemand: { us: 520000, asia: 1220000, europe: 360000 },
      competitorCount: 4,
      priceRange: { min: 95, max: 170 },
    },
    history: [
      { round: 1, myDecision: {}, myResults: {}, marketSnapshot: {} },
      { round: 2, myDecision: {}, myResults: {}, marketSnapshot: {} },
    ],
    strategyState: {},
  })

  const handleTestStrategy = async (strategy: ParsedStudentStrategy) => {
    setTestingStrategyId(strategy.id)
    const start = performance.now()

    try {
      const runResult = await runStudentStrategyInWorkerDetailed(strategy.source, buildDryRunContext())
      const runtimeMs = Math.round((performance.now() - start) * 100) / 100
      const output = runResult.modifiers || {}
      const hasOutput = output && typeof output === 'object' && Object.keys(output as Record<string, unknown>).length > 0

      let message = ''
      let ok = false
      if (runResult.timedOut) {
        message = runResult.error || 'Execution timeout'
      } else if (!runResult.ok) {
        message = runResult.error || 'Execution error'
      } else if (!hasOutput) {
        message = 'No valid strategy fields returned (empty after validation)'
      } else {
        message = 'Dry run passed'
        ok = true
      }

      setStrategyTestResults((prev) => ({
        ...prev,
        [strategy.id]: {
          ok,
          runtimeMs,
          output,
          message,
        },
      }))
    } catch (error) {
      const runtimeMs = Math.round((performance.now() - start) * 100) / 100
      setStrategyTestResults((prev) => ({
        ...prev,
        [strategy.id]: {
          ok: false,
          runtimeMs,
          output: {},
          message: error instanceof Error ? error.message : 'Dry run failed',
        },
      }))
    } finally {
      setTestingStrategyId(null)
    }
  }

  const handleRemoveStrategy = (strategyId: string) => {
    setUploadedStrategies((prev) => prev.filter((item) => item.id !== strategyId))
    setStrategyTestResults((prev) => {
      const next = { ...prev }
      delete next[strategyId]
      return next
    })
  }

  return (
    <main className="slg-page">
      <div className="slg-header">
        <h1>Aigology Strategy Lab — Student Guide</h1>
        <p>
          Share this page with students:{' '}
          <code>/strategy-lab/student-guide</code>
        </p>
      </div>
      <section className="slg-tester">
        <h2>Try Your Strategy (.js)</h2>
        <p>
          Upload your file, click <strong>Test</strong>, and confirm your <code>execute(context)</code> output is valid.
        </p>
        <div className="slg-tester-actions">
          <label className="slg-btn">
            Upload .js
            <input type="file" accept=".js,.mjs" multiple onChange={handleUploadFiles} />
          </label>
          <a className="slg-btn slg-btn-link" href="/strategy-lab/student_strategy_template.js" download title="Download starter template">Template ⭳</a>
          <a className="slg-btn slg-btn-link" href="/strategy-lab/samples/sample_cost_guard.js" download title="Download sample strategy 1">Sample 1 ⭳</a>
          <a className="slg-btn slg-btn-link" href="/strategy-lab/samples/sample_share_chaser.js" download title="Download sample strategy 2">Sample 2 ⭳</a>
        </div>
        {uploadErrors.length > 0 && (
          <div className="slg-errors">
            {uploadErrors.map((msg, idx) => (
              <div key={`${msg}-${idx}`}>{msg}</div>
            ))}
          </div>
        )}
        {uploadedStrategies.length > 0 && (
          <div className="slg-uploaded">
            {uploadedStrategies.map((item) => (
              <div key={item.id} className="slg-uploaded-item">
                <div className="slg-uploaded-head">
                  <div>
                    <div className="slg-uploaded-name">{item.name}</div>
                    <div className="slg-uploaded-meta">by {item.author}</div>
                  </div>
                  <div className="slg-uploaded-buttons">
                    <button className="slg-btn" type="button" onClick={() => handleTestStrategy(item)} disabled={testingStrategyId === item.id}>
                      {testingStrategyId === item.id ? 'Testing...' : 'Test'}
                    </button>
                    <button className="slg-btn slg-btn-danger" type="button" onClick={() => handleRemoveStrategy(item.id)}>Remove</button>
                  </div>
                </div>
                {strategyTestResults[item.id] && (
                  <div className="slg-test-result">
                    <div className={strategyTestResults[item.id].ok ? 'slg-pass' : 'slg-warn'}>
                      {strategyTestResults[item.id].message} ({strategyTestResults[item.id].runtimeMs}ms)
                    </div>
                    <pre>{JSON.stringify(strategyTestResults[item.id].output, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {loading ? (
        <p className="slg-loading">Loading guide...</p>
      ) : (
        <article className="slg-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      )}
      <section className="slg-downloads">
        <h2>Downloads</h2>
        <div className="slg-downloads-row">
          <a className="slg-btn" href="/strategy-lab/student_strategy_template.js" download>
            Template ⭳
          </a>
          <a className="slg-btn" href="/strategy-lab/samples/sample_cost_guard.js" download>
            Cost Guard ⭳
          </a>
          <a className="slg-btn" href="/strategy-lab/samples/sample_share_chaser.js" download>
            Share Chaser ⭳
          </a>
        </div>
      </section>
      <style>{`
        .slg-page {
          max-width: 860px;
          margin: 0 auto;
          padding: 2rem 1.5rem 4rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
          background: #ffffff;
          line-height: 1.7;
        }
        .slg-header {
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }
        .slg-header h1 {
          font-size: 1.8rem;
          margin: 0 0 0.5rem;
          color: #0f172a;
        }
        .slg-header p {
          color: #64748b;
          margin: 0;
          font-size: 0.9rem;
        }
        .slg-header code {
          background: #f1f5f9;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85rem;
        }
        .slg-loading {
          color: #64748b;
          text-align: center;
          padding: 3rem;
        }
        .slg-tester {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          background: #f8fafc;
        }
        .slg-tester h2 {
          margin: 0 0 0.35rem;
          font-size: 1.2rem;
          color: #0f172a;
        }
        .slg-tester p {
          margin: 0 0 0.75rem;
          color: #475569;
          font-size: 0.92rem;
        }
        .slg-tester-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .slg-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          border-radius: 8px;
          font-size: 0.85rem;
          padding: 0.4rem 0.7rem;
          cursor: pointer;
          text-decoration: none;
        }
        .slg-btn input {
          display: none;
        }
        .slg-btn-danger {
          color: #b91c1c;
        }
        .slg-errors {
          margin-top: 0.6rem;
          color: #b91c1c;
          font-size: 0.82rem;
        }
        .slg-uploaded {
          margin-top: 0.75rem;
          display: grid;
          gap: 0.5rem;
        }
        .slg-uploaded-item {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 0.6rem;
          background: #fff;
        }
        .slg-uploaded-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .slg-uploaded-name {
          font-weight: 700;
          font-size: 0.9rem;
        }
        .slg-uploaded-meta {
          font-size: 0.78rem;
          color: #64748b;
        }
        .slg-uploaded-buttons {
          display: flex;
          gap: 0.4rem;
        }
        .slg-test-result {
          margin-top: 0.6rem;
        }
        .slg-pass {
          font-size: 0.78rem;
          color: #15803d;
          margin-bottom: 0.35rem;
        }
        .slg-warn {
          font-size: 0.78rem;
          color: #b45309;
          margin-bottom: 0.35rem;
        }
        .slg-test-result pre {
          margin: 0;
          white-space: pre-wrap;
          font-size: 0.74rem;
          line-height: 1.4;
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.6rem;
          border-radius: 8px;
          overflow-x: auto;
        }
        .slg-content h1 {
          display: none;
        }
        .slg-content h2 {
          font-size: 1.5rem;
          color: #0f172a;
          margin-top: 3rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .slg-content h3 {
          font-size: 1.15rem;
          color: #1e293b;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .slg-content p {
          margin: 0.75rem 0;
        }
        .slg-content strong {
          color: #0f172a;
        }
        .slg-content hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 2.5rem 0;
        }
        .slg-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.9rem;
        }
        .slg-content th {
          background: #f8fafc;
          text-align: left;
          padding: 0.6rem 0.75rem;
          border: 1px solid #e2e8f0;
          font-weight: 600;
          color: #334155;
        }
        .slg-content td {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          color: #475569;
        }
        .slg-content tr:nth-child(even) td {
          background: #f8fafc;
        }
        .slg-content code {
          background: #f1f5f9;
          padding: 0.15rem 0.35rem;
          border-radius: 3px;
          font-size: 0.85em;
          color: #be185d;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .slg-content pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1rem 1.25rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1rem 0;
          line-height: 1.5;
        }
        .slg-content pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: 0.85rem;
        }
        .slg-content ul, .slg-content ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .slg-content li {
          margin: 0.4rem 0;
        }
        .slg-content blockquote {
          border-left: 3px solid #3b82f6;
          margin: 1rem 0;
          padding: 0.5rem 1rem;
          background: #eff6ff;
          color: #1e40af;
          border-radius: 0 6px 6px 0;
        }
        .slg-downloads {
          margin-top: 3rem;
          padding-top: 1.5rem;
          border-top: 2px solid #e2e8f0;
        }
        .slg-downloads h2 {
          font-size: 1.3rem;
          margin: 0 0 0.75rem;
          color: #0f172a;
        }
        .slg-downloads-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
      `}</style>
    </main>
  )
}

