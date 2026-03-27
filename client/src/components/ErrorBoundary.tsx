import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--text)',
          maxWidth: 400,
          margin: '60px auto',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🦞</div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 8,
            color: 'var(--accent)',
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--muted2)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              padding: '10px 24px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
