import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function LegalPage() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="legal-container">
      <nav className="legal-nav">
        <div className="legal-nav-content">
          <div className="legal-logo" onClick={() => navigate('/landing')}>
            <div className="logo-box" aria-hidden="true">
              <svg className="logo-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M12 18V5" />
                <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
                <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
                <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
                <path d="M18 18a4 4 0 0 0 2-7.464" />
                <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
                <path d="M6 18a4 4 0 0 1-2-7.464" />
                <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
              </svg>
            </div>
            <span className="logo-text">AI Decision Lab</span>
          </div>
          <button
            onClick={() => {
              // If we have history in this tab, just go back
              if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
                navigate(-1)
              }
              // If it's a new tab (opened from the game), closing is the most natural "back"
              else if (window.opener || window.history.length === 1) {
                window.close()
                // Fallback if window.close() is blocked or doesn't work
                setTimeout(() => navigate('/landing'), 100)
              }
              else {
                navigate('/landing')
              }
            }}
            className="back-btn"
          >
            Return to Previous Page
          </button>
        </div>
      </nav>

      <main className="legal-main">
        <header className="legal-header">
          <h1>Legal Information</h1>
          <p>Privacy Policy and Disclaimer for AI Decision Lab</p>
        </header>

        <section id="privacy-policy" className="legal-section">
          <div className="section-title">
            <div className="title-icon privacy">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h2>Privacy Policy</h2>
          </div>

          <div className="legal-content">
            <p className="last-updated">Last Updated: January 23, 2026</p>

            <h3>1. Information We Collect</h3>
            <p>AI Decision Lab collects minimal information necessary to provide the simulation experience:</p>
            <ul>
              <li><strong>Team Information:</strong> Team names and decisions provided by participants during the game.</li>
              <li><strong>Usage Data:</strong> Basic technical information such as IP addresses (for security) and browser types.</li>
              <li><strong>Cookies:</strong> Essential session cookies to maintain your login status.</li>
            </ul>

            <h3>2. How We Use Data</h3>
            <p>Your data is used exclusively for calculating simulation results, providing performance reports, and improving the user experience. We do not use your data for advertising or marketing.</p>

            <h3>3. Data Sharing</h3>
            <p>We do not sell or trade your information. Data is only accessible to the educator/administrator of your specific game session.</p>
          </div>
        </section>

        <section id="disclaimer" className="legal-section">
          <div className="section-title">
            <div className="title-icon disclaimer">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <h2>Disclaimer</h2>
          </div>

          <div className="legal-content">
            <div className="disclaimer-callout">
              AI Decision Lab is an <strong>educational simulation</strong>. All companies, financial data, and market results are entirely fictional.
            </div>

            <h3>1. Educational Purposes Only</h3>
            <p>This platform is designed for academic and training purposes. It does not reflect real-market behavior or guarantee real-world outcomes.</p>

            <h3>2. No Financial Advice</h3>
            <p>Results generated (like Share Price or Net Profit) have no real-world value and do not constitute financial or investment advice.</p>

            <h3>3. Limitation of Liability</h3>
            <p>AI Decision Lab is provided "as is". We are not responsible for any pedagogical conclusions or technical issues during live sessions.</p>
          </div>
        </section>

        <footer className="legal-footer">
          <p>&copy; {new Date().getFullYear()} AI Decision Lab. All rights reserved.</p>
        </footer>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        .legal-container {
          min-height: 100vh;
          background-color: var(--bg-page);
          color: var(--text-main);
          font-family: 'Inter', sans-serif;
          line-height: 1.6;
        }

        .legal-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--bg-card);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--border-color);
          padding: 0 2rem;
        }

        .legal-nav-content {
          max-width: 1000px;
          margin: 0 auto;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .legal-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .logo-box {
          width: 32px;
          height: 32px;
          background: #2563eb;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          border-radius: 6px;
          font-family: 'Outfit', sans-serif;
        }

        .logo-icon {
          width: 18px;
          height: 18px;
        }

        .logo-text {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-main);
        }

        .back-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }

        .back-btn:hover {
          background: var(--bg-hover);
          color: var(--text-main);
        }

        .legal-main {
          max-width: 800px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }

        .legal-header {
          margin-bottom: 4rem;
        }

        .legal-header h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 3rem;
          font-weight: 800;
          margin: 0 0 1rem;
          letter-spacing: -0.03em;
          color: var(--text-main);
        }

        .legal-header p {
          font-size: 1.25rem;
          color: var(--text-muted);
        }

        .legal-section {
          margin-bottom: 4rem;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .title-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .title-icon.privacy {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .title-icon.disclaimer {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .section-title h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 2rem;
          margin: 0;
          color: var(--text-main);
          font-weight: 700;
        }

        .legal-content h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          margin: 2.5rem 0 1rem;
          color: var(--text-main);
          font-weight: 600;
        }

        .legal-content p, .legal-content li {
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .legal-content ul {
          padding-left: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .last-updated {
          font-size: 0.875rem;
          font-style: italic;
          opacity: 0.7;
          color: var(--text-muted) !important;
        }

        .disclaimer-callout {
          background: var(--bg-hover);
          border: 1px solid var(--border-color);
          padding: 1.5rem;
          border-radius: 12px;
          color: var(--text-main);
          margin-bottom: 2rem;
        }

        .legal-footer {
          margin-top: 6rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border-color);
          text-align: center;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        @media (max-width: 640px) {
          .legal-header h1 {
            font-size: 2.25rem;
          }
          .section-title h2 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}

export default LegalPage
