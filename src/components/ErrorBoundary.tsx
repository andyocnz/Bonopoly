/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 */

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('Error Boundary caught an error:', error, errorInfo)

    // Update state with error details
    this.setState({
      error,
      errorInfo
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Otherwise, render default error view
      return (
        <ErrorView
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default Error View
 */
interface ErrorViewProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  onReset: () => void
}

function ErrorView({ error, errorInfo, onReset }: ErrorViewProps) {
  const isDevelopment = import.meta.env.DEV

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main)',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-main)',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Error Icon */}
        <div style={{
          fontSize: '4rem',
          textAlign: 'center',
          marginBottom: '1.5rem'
        }}>
          ⚠️
        </div>

        {/* Error Title */}
        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.5rem',
          color: 'var(--text-main)',
          textAlign: 'center'
        }}>
          Something Went Wrong
        </h2>

        {/* Error Description */}
        <p style={{
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          The application encountered an unexpected error. This has been logged and we'll look into it.
        </p>

        {/* Error Details (Development Only) */}
        {isDevelopment && error && (
          <details style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-main)',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--text-main)',
              marginBottom: '0.5rem'
            }}>
              Error Details (Development Mode)
            </summary>
            <div style={{
              marginTop: '1rem',
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              fontSize: '0.8rem'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Error:</strong>
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderLeft: '3px solid #ef4444',
                  color: '#dc2626'
                }}>
                  {error.toString()}
                </div>
              </div>
              {errorInfo && errorInfo.componentStack && (
                <div>
                  <strong>Component Stack:</strong>
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(100, 116, 139, 0.1)',
                    borderLeft: '3px solid #64748b',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {errorInfo.componentStack}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button
            onClick={onReset}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--pro-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Try Again
          </button>

          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--bg-subtle)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-main)',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Go to Home
          </button>
        </div>

        {/* Help Text */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-main)',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: 'var(--text-main)' }}>💡 Tip:</strong> If this error persists, try:
          <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
            <li>Refreshing the page</li>
            <li>Clearing your browser cache</li>
            <li>Checking the browser console for more details</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
