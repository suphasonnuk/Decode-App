import { useState } from 'react'
import { setAuthToken } from '../store'
import { api } from '../api'

interface Props { onAuth: () => void }

export default function Auth({ onAuth }: Props) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!token.trim()) { setError('Please enter your access token'); return }
    setLoading(true)
    setError('')
    setAuthToken(token.trim())
    try {
      const h = await api.health()
      if (h.status === 'ok') { onAuth() }
      else { setError('Unexpected response — check server'); setAuthToken('') }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('Unauthorized') || msg.includes('401')) {
        setError('Wrong token — check your APP_SECRET value')
      } else {
        setError('Cannot reach server — is it running?')
      }
      setAuthToken('')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-emoji">🦞</div>
        <h1 className="auth-title">DECODE</h1>
        <p className="auth-tagline">Your daily direction system</p>
        <div className="auth-divider" />
        <p className="auth-label">Enter your access token to continue</p>
        <input
          className={`auth-input ${error ? 'invalid' : ''}`}
          type="password"
          placeholder="Access token..."
          value={token}
          onChange={e => { setToken(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        {error && <div className="auth-error">{error}</div>}
        <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{width:'100%',marginTop:4}}>
          {loading ? <span className="spinner show" /> : null}
          {loading ? 'Checking...' : 'Enter'}
        </button>
        <p className="auth-hint">Token is set via APP_SECRET in your .env file or Cloud Run environment variables.</p>
      </div>
    </div>
  )
}