import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

interface UserPresence {
  user_id:      string
  display_name: string
  last_seen:    string | null
  day_outcome:  string | null
  energy_level: number | null
  status:       'online' | 'recent' | 'away' | 'offline'
  is_me:        boolean
}

interface Props {
  isOpen:  boolean
  onClose: () => void
}

const STATUS_CONFIG = {
  online:  { color: '#a5d6a7', label: 'Online now',      dot: '#4caf50' },
  recent:  { color: '#ffb74d', label: 'Active recently', dot: '#ff9800' },
  away:    { color: '#787878', label: 'Away',             dot: '#9e9e9e' },
  offline: { color: '#484848', label: 'Offline',          dot: '#424242' },
}

const OUTCOME_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  win:     { emoji: '🏆', color: '#a5d6a7', label: 'WIN'     },
  partial: { emoji: '⚡', color: '#ffb74d', label: 'PARTIAL' },
  miss:    { emoji: '✗',  color: '#ef5350', label: 'MISS'    },
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const safeName = (name || '?').trim() || '?'
  const initials = safeName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  // Deterministic color from name
  const hue = safeName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue}, 45%, 28%)`,
      border: `2px solid hsl(${hue}, 45%, 40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 800,
      fontSize: size * 0.36, color: `hsl(${hue}, 70%, 80%)`,
    }}>
      {initials}
    </div>
  )
}

export default function FriendsPanel({ isOpen, onClose }: Props) {
  const [users,   setUsers]   = useState<UserPresence[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchPresence = useCallback(() => {
    api.getUsersPresence()
      .then(data => { setUsers(data); setError('') })
      .catch(() => setError('Could not load users'))
      .finally(() => setLoading(false))
  }, [])

  // Fetch on open, then poll every 30s while open
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchPresence()
    const interval = setInterval(fetchPresence, 30_000)
    return () => clearInterval(interval)
  }, [isOpen, fetchPresence])

  const online  = users.filter(u => u.status === 'online')
  const recent  = users.filter(u => u.status === 'recent')
  const away    = users.filter(u => u.status === 'away')
  const offline = users.filter(u => u.status === 'offline')

  const sections = [
    { label: 'Online now', users: online,  emptyHide: true  },
    { label: 'Active today', users: [...recent, ...away], emptyHide: false },
    { label: 'Offline', users: offline, emptyHide: true },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className={`friends-backdrop ${isOpen ? 'friends-backdrop-visible' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`friends-panel ${isOpen ? 'friends-panel-open' : ''}`}>

        {/* Header */}
        <div className="friends-header">
          <div className="friends-header-left">
            <span className="friends-header-icon">👥</span>
            <div>
              <div className="friends-header-title">DECODE Users</div>
              <div className="friends-header-sub">
                {loading ? 'Loading...' : `${online.length} online · ${users.length} total`}
              </div>
            </div>
          </div>
          <button className="friends-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="friends-body">

          {loading && (
            <div className="friends-loading">
              <div className="coach-loading-dots"><div /><div /><div /></div>
            </div>
          )}

          {error && !loading && (
            <div className="friends-empty">
              <div className="friends-empty-icon">😴</div>
              <div className="friends-empty-text">{error}</div>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="friends-empty">
              <div className="friends-empty-icon">👋</div>
              <div className="friends-empty-text">No other users yet.</div>
              <div className="friends-empty-sub">When others join DECODE they'll appear here.</div>
            </div>
          )}

          {!loading && !error && sections.map(section => {
            if (section.emptyHide && section.users.length === 0) return null
            return (
              <div key={section.label} className="friends-section">
                <div className="friends-section-label">
                  {section.label}
                  <span className="friends-section-count">{section.users.length}</span>
                </div>
                {section.users.length === 0 && (
                  <div className="friends-section-empty">No one here right now</div>
                )}
                {section.users.map(user => {
                  const cfg     = STATUS_CONFIG[user.status]
                  const outcome = user.day_outcome ? OUTCOME_CONFIG[user.day_outcome] : null
                  return (
                    <div key={user.user_id} className={`friends-user-row ${user.is_me ? 'friends-user-me' : ''}`}>

                      {/* Avatar + status dot */}
                      <div className="friends-avatar-wrap">
                        <Avatar name={user.display_name} size={40} />
                        <div className="friends-status-dot" style={{ background: cfg.dot }} />
                      </div>

                      {/* Info */}
                      <div className="friends-user-info">
                        <div className="friends-user-name">
                          {user.display_name}
                          {user.is_me && <span className="friends-you-badge">you</span>}
                        </div>
                        <div className="friends-user-meta">
                          <span style={{ color: cfg.color }}>{cfg.label}</span>
                          <span className="friends-meta-sep">·</span>
                          <span>{timeAgo(user.last_seen)}</span>
                        </div>
                      </div>

                      {/* Today's outcome */}
                      <div className="friends-outcome">
                        {outcome
                          ? <span className="friends-outcome-pill" style={{ color: outcome.color, borderColor: `${outcome.color}40`, background: `${outcome.color}12` }}>
                              {outcome.emoji} {outcome.label}
                            </span>
                          : <span className="friends-outcome-empty">—</span>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="friends-footer">
          <div className="friends-footer-text">
            You appear when you have a name set in your profile.
          </div>
          <button className="friends-refresh-btn" onClick={fetchPresence}>
            ↻ Refresh
          </button>
        </div>
      </div>
    </>
  )
}
