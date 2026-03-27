import { useState, useEffect } from 'react'
import { api } from '../api'
import { todayStr } from '../store'

interface Challenge {
  category:    string
  icon:        string
  observation: string
  challenge:   string
  science:     string
  source:      string
  difficulty:  string
}

interface Props {
  onDone: (accepted: boolean) => void
}

const CACHE_KEY     = () => 'decode_challenge_' + todayStr()
const SEEN_KEY      = () => 'decode_challenge_seen_' + todayStr()
const ACCEPTED_KEY  = () => 'decode_challenge_done_' + todayStr()

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   'var(--win)',
  medium: 'var(--partial)',
  hard:   'var(--miss)',
}
const DIFFICULTY_LABEL: Record<string, string> = {
  easy:   '🟢 Easy',
  medium: '🟡 Medium',
  hard:   '🔴 Hard',
}

export default function ChallengePopup({ onDone }: Props) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [visible,   setVisible]   = useState(false)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    // Try cache first
    const cached = sessionStorage.getItem(CACHE_KEY())
    if (cached) {
      try {
        setChallenge(JSON.parse(cached))
        setLoading(false)
        setTimeout(() => setVisible(true), 80)
        return
      } catch {}
    }

    // Fetch from API
    api.getChallenge()
      .then(data => {
        setChallenge(data)
        sessionStorage.setItem(CACHE_KEY(), JSON.stringify(data))
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false)
        setTimeout(() => setVisible(true), 80)
      })
  }, [])

  const dismiss = (accepted: boolean) => {
    setVisible(false)
    // Mark as seen so it doesn't show again today
    try {
      sessionStorage.setItem(SEEN_KEY(), '1')
      if (accepted) sessionStorage.setItem(ACCEPTED_KEY(), '1')
    } catch {}
    setTimeout(() => onDone(accepted), 380)
  }

  const diffColor = challenge ? (DIFFICULTY_COLOR[challenge.difficulty] ?? 'var(--muted2)') : 'var(--muted2)'
  const diffLabel = challenge ? (DIFFICULTY_LABEL[challenge.difficulty] ?? challenge.difficulty) : ''

  return (
    <div className={`challenge-overlay ${visible ? 'challenge-overlay-visible' : ''}`}>
      <div className="challenge-sheet">

        {/* Handle */}
        <div className="challenge-sheet-handle" />

        {loading && (
          <div className="challenge-loading">
            <div className="coach-loading-dots"><div /><div /><div /></div>
            <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 10 }}>
              Analysing your data...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="challenge-loading">
            <div style={{ fontSize: 32, marginBottom: 10 }}>😴</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
              Could not load today's challenge — check your connection.
            </div>
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => dismiss(false)}>
              Skip for now
            </button>
          </div>
        )}

        {challenge && !loading && (
          <>
            {/* Header */}
            <div className="challenge-sheet-top">
              <div className="challenge-sheet-eyebrow">Today's challenge</div>
              <div className="challenge-sheet-category">
                <div
                  className="challenge-sheet-icon-wrap"
                  style={{ background: `${diffColor}15` }}
                >
                  <span>{challenge.icon}</span>
                </div>
                <div>
                  <div className="challenge-sheet-cat-name">{challenge.category}</div>
                  <div className="challenge-sheet-diff" style={{ color: diffColor }}>
                    {diffLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* Observation — what your data says */}
            <div className="challenge-sheet-observation">
              <span className="challenge-obs-dot" />
              <span>{challenge.observation}</span>
            </div>

            {/* The challenge itself — highlighted */}
            <div className="challenge-sheet-body">
              <p className="challenge-sheet-text">{challenge.challenge}</p>
            </div>

            {/* Science backing */}
            <div className="challenge-sheet-science">
              <span style={{ fontSize: 13, flexShrink: 0 }}>📊</span>
              <div>
                <div className="challenge-science-text">{challenge.science}</div>
                <div className="challenge-science-source">{challenge.source}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="challenge-sheet-actions">
              <button
                className="btn-primary"
                onClick={() => dismiss(true)}
              >
                ✓ Try this today
              </button>
              <button
                className="btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => dismiss(false)}
              >
                Skip for now
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// Helper used by App.tsx to decide whether to show the popup
export function shouldShowChallengePopup(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY()) !== '1'
  } catch {
    return false
  }
}
