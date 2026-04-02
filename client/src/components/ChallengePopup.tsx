import { useState, useEffect } from 'react'
import { api } from '../api'
import { alpha } from '../lib/color'
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
    let visTimer: ReturnType<typeof setTimeout>
    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY())
    if (cached) {
      try {
        setChallenge(JSON.parse(cached))
        setLoading(false)
        visTimer = setTimeout(() => setVisible(true), 80)
        return () => clearTimeout(visTimer)
      } catch {}
    }

    // Fetch from API
    api.getChallenge()
      .then(data => {
        setChallenge(data)
        localStorage.setItem(CACHE_KEY(), JSON.stringify(data))
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false)
        visTimer = setTimeout(() => setVisible(true), 80)
      })
    return () => clearTimeout(visTimer)
  }, [])

  const dismiss = (accepted: boolean) => {
    setVisible(false)
    // Mark as seen so it doesn't show again today
    try {
      localStorage.setItem(SEEN_KEY(), '1')
      if (accepted) localStorage.setItem(ACCEPTED_KEY(), '1')
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
            <div className="coach-welcome-hint">
              Analysing your data...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="challenge-loading">
            <div className="empty-state-icon">😴</div>
            <div className="empty-state-desc">
              Could not load today's challenge — check your connection.
            </div>
            <button className="btn-secondary mt-4" onClick={() => dismiss(false)}>
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
                  style={{ background: alpha(diffColor, 10) }}
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
              <span className="challenge-science-icon">📊</span>
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
                className="btn-secondary mt-2"
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
// Re-export from shared lib for backwards compatibility
export { shouldShowChallengePopup } from '../lib/challenge'
