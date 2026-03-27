import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { getUserId } from '../store'

interface CoachData {
  greeting:    string
  summary:     string
  patterns:    string[]
  action:      string
  score:       number | null
  data_points: number
  win_rate:    number
}

function ScoreMeter({ score }: { score: number }) {
  const color =
    score >= 8 ? 'var(--win)'     :
    score >= 6 ? 'var(--future)'  :
    score >= 4 ? 'var(--partial)' :
                 'var(--miss)'

  const label =
    score >= 9 ? 'Exceptional'  :
    score >= 7 ? 'Strong'       :
    score >= 5 ? 'Developing'   :
    score >= 3 ? 'Struggling'   : 'Needs focus'

  return (
    <div className="coach-score-wrap">
      <div className="coach-score-ring" style={{ '--score-color': color } as React.CSSProperties}>
        <svg viewBox="0 0 80 80" className="coach-score-svg">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border2)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(score / 10) * 213.6} 213.6`}
            strokeDashoffset="53.4"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="coach-score-inner">
          <div className="coach-score-num" style={{ color }}>{score}</div>
          <div className="coach-score-denom">/10</div>
        </div>
      </div>
      <div>
        <div className="coach-score-label" style={{ color }}>{label}</div>
        <div className="coach-score-sub">performance score</div>
      </div>
    </div>
  )
}

export default function Coach() {
  const [data,    setData]    = useState<CoachData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [cached,  setCached]  = useState<{ data: CoachData; ts: number } | null>(() => {
    try {
      const raw = localStorage.getItem('decode_coach_cache')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // Cache valid for 6 hours
      if (Date.now() - parsed.ts < 6 * 60 * 60 * 1000) return parsed
    } catch {}
    return null
  })

  const userId = getUserId()

  useEffect(() => {
    if (cached) setData(cached.data)
  }, [])

  const fetchCoaching = async (force = false) => {
    if (!force && cached) return   // Use cache
    setLoading(true)
    setError('')
    try {
      const res = await api.getCoaching(userId)
      setData(res)
      const entry = { data: res, ts: Date.now() }
      setCached(entry)
      localStorage.setItem('decode_coach_cache', JSON.stringify(entry))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coach unavailable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">AI Coach</div>
        <div className="page-intro-sub">Personalized insights from your BigQuery data · Powered by Claude</div>
      </div>

      {/* Empty / welcome state */}
      {!data && !loading && !error && (
        <div className="coach-welcome">
          <div className="coach-welcome-emoji">🤖</div>
          <div className="coach-welcome-title">Your personal performance coach</div>
          <div className="coach-welcome-desc">
            Claude reads your last 30 days of data from BigQuery — energy, focus, mood, task completion, outcomes — and gives you personalized pattern analysis and one specific action for this week.
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => fetchCoaching()}>
            Generate my coaching report →
          </button>
          <p style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            Requires ANTHROPIC_API_KEY set in Cloud Run environment variables.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="coach-loading">
          <div className="coach-loading-dots">
            <div /><div /><div />
          </div>
          <div className="coach-loading-label">Claude is reading your data...</div>
          <div className="coach-loading-sub">Analyzing patterns in your last 30 days</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="coach-error">
          <div className="coach-error-icon">⚠️</div>
          <div className="coach-error-title">Coach unavailable</div>
          <div className="coach-error-msg">{error}</div>
          <button className="btn-secondary" style={{ marginTop: 14 }} onClick={() => fetchCoaching(true)}>
            Try again
          </button>
        </div>
      )}

      {/* Coaching report */}
      {data && !loading && (
        <div>
          {/* Header with score */}
          <div className="coach-report-header">
            {data.score && <ScoreMeter score={data.score} />}
            <div className="coach-meta">
              <div className="coach-data-points">{data.data_points} days analyzed</div>
              <div className="coach-win-rate" style={{
                color: data.win_rate >= 70 ? 'var(--win)' : data.win_rate >= 40 ? 'var(--future)' : 'var(--miss)'
              }}>
                {data.win_rate}% win rate
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="coach-greeting">{data.greeting}</div>

          {/* Summary */}
          <div className="card">
            <div className="card-label">This week's summary</div>
            <div className="coach-summary">{data.summary}</div>
          </div>

          {/* Patterns */}
          <div className="card">
            <div className="card-label">Patterns from your data</div>
            <div className="coach-patterns">
              {data.patterns.map((p, i) => (
                <div key={i} className="coach-pattern">
                  <span className="coach-pattern-num">{i + 1}</span>
                  <span className="coach-pattern-text">{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="coach-action-card">
            <div className="coach-action-label">🎯 Your one action this week</div>
            <div className="coach-action-text">{data.action}</div>
          </div>

          {/* Refresh */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <button className="btn-secondary" onClick={() => fetchCoaching(true)}>
              ↻ Refresh coaching report
            </button>
          </div>
          <p style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
            Report cached for 6 hours · Each refresh uses your Anthropic API quota
          </p>
        </div>
      )}
    </div>
  )
}