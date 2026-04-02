import { useState, useEffect } from 'react'
import { api } from '../api'
import type { DecodedInsights, DecodedPortrait } from '../api'
import { getEmotionById } from '../data/emotions'
import { getUserId } from '../store'
import { alpha } from '../lib/color'

export default function Decode() {
  const [data, setData] = useState<DecodedInsights | null>(null)
  const [portrait, setPortrait] = useState<DecodedPortrait | null>(null)
  const [loading, setLoading] = useState(true)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [error, setError] = useState('')
  const [portraitError, setPortraitError] = useState('')
  const [portraitCached, setPortraitCached] = useState(false)

  const userId = getUserId()

  useEffect(() => {
    // Check portrait cache (24h)
    try {
      const cached = localStorage.getItem('decode_portrait')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
          setPortrait(parsed.data)
          setPortraitCached(true)
        }
      }
    } catch {}

    api.getDecoded()
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const generatePortrait = async () => {
    setPortraitLoading(true)
    try {
      const res = await api.getDecodedPortrait(userId)
      if (res.portrait) {
        setPortrait(res.portrait)
        try {
          localStorage.setItem('decode_portrait', JSON.stringify({ data: res.portrait, ts: Date.now() }))
        } catch {}
      }
    } catch (err) {
      setPortraitError(err instanceof Error ? err.message : 'Failed to generate portrait')
    } finally {
      setPortraitLoading(false)
    }
  }

  if (loading) return (
    <div className="decode-loading">
      <div className="coach-loading-dots"><div /><div /><div /></div>
      <div className="decode-loading-text">Decoding your data...</div>
    </div>
  )

  if (error) return (
    <div className="decode-error">
      <span>Could not load insights: {error}</span>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
    </div>
  )

  if (!data?.ready) return (
    <div className="decode-empty">
      <div className="decode-empty-icon">🔬</div>
      <div className="decode-empty-title">Not enough data yet</div>
      <div className="decode-empty-sub">{data?.message || 'Keep logging daily — you need at least 5 days for insights.'}</div>
      <div className="decode-empty-progress">
        <div className="decode-empty-bar">
          <div className="decode-empty-fill" style={{ width: `${Math.min(((data?.days_logged ?? 0) / 5) * 100, 100)}%` }} />
        </div>
        <span>{data?.days_logged ?? 0}/5 days logged</span>
      </div>
    </div>
  )

  const { overview, correlations, day_of_week, emotions, energy_outcome, insights } = data

  return (
    <div className="decode-page">
      <div className="page-intro">
        <div className="page-intro-title">Decode Yourself</div>
        <div className="page-intro-sub">
          {data.days_completed} days analyzed — patterns you can't see alone
        </div>
      </div>

      {/* AI Self-Portrait */}
      <div className="decode-section">
        <div className="decode-section-header">
          <span className="decode-section-icon">🪞</span>
          <span className="decode-section-title">Your Self-Portrait</span>
        </div>

        {portrait ? (
          <div className="decode-portrait">
            <div className="decode-portrait-title">{portrait.title}</div>
            <div className="decode-portrait-text">
              {portrait.portrait.split('\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <div className="decode-portrait-cards">
              <div className="decode-portrait-card decode-portrait-strength">
                <div className="decode-portrait-card-label">Your Strength</div>
                <div className="decode-portrait-card-text">{portrait.strength}</div>
              </div>
              <div className="decode-portrait-card decode-portrait-blind">
                <div className="decode-portrait-card-label">Your Blind Spot</div>
                <div className="decode-portrait-card-text">{portrait.blind_spot}</div>
              </div>
            </div>

            <div className="decode-portrait-question">
              <span className="decode-portrait-q-icon">?</span>
              <span>{portrait.question}</span>
            </div>

            <button className="decode-refresh-btn" onClick={generatePortrait} disabled={portraitLoading}>
              {portraitLoading ? 'Regenerating...' : 'Regenerate portrait'}
            </button>
          </div>
        ) : (
          <div className="decode-portrait-generate">
            <p>Generate an AI-powered self-portrait based on your behavioral data. This uses your tasks, emotions, reflections, and patterns to describe who you are in ways you might not see yourself.</p>
            {portraitError && <div className="field-error" style={{ marginBottom: 8 }}>{portraitError}</div>}
            <button className="btn-primary btn-full" onClick={() => { setPortraitError(''); generatePortrait() }} disabled={portraitLoading}>
              {portraitLoading ? (
                <><span className="spinner show" /> Analyzing your data...</>
              ) : (
                'Generate My Self-Portrait'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Key Insights — the "decoded" revelations */}
      {insights && insights.length > 0 && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">💡</span>
            <span className="decode-section-title">Decoded Insights</span>
          </div>
          <div className="decode-insights-list">
            {insights.map((insight, i) => (
              <div key={i} className="decode-insight-card">
                <div className="decode-insight-num">{i + 1}</div>
                <div className="decode-insight-text">{insight}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotion Map */}
      {emotions && emotions.total_days_with_emotions > 0 && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">🎭</span>
            <span className="decode-section-title">Your Emotion Map</span>
          </div>
          <div className="decode-emotion-grid">
            {emotions.top_emotions.map(e => {
              const em = getEmotionById(e.emotion)
              if (!em) return null
              return (
                <div key={e.emotion} className="decode-emotion-item">
                  <div className="decode-emotion-bar-wrap">
                    <div
                      className="decode-emotion-bar"
                      style={{
                        width: `${Math.max(e.pct, 8)}%`,
                        background: em.color,
                      }}
                    />
                  </div>
                  <div className="decode-emotion-info">
                    <span className="decode-emotion-emoji">{em.emoji}</span>
                    <span className="decode-emotion-name">{em.label}</span>
                    <span className="decode-emotion-pct" style={{ color: em.color }}>{e.pct}%</span>
                  </div>
                  {e.winCorrelation > 0 && (
                    <div className="decode-emotion-win">
                      WIN rate when feeling {em.label.toLowerCase()}: {e.winCorrelation}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {emotions.win_emotions.length > 0 && emotions.miss_emotions.length > 0 && (
            <div className="decode-emotion-contrast">
              <div className="decode-emotion-contrast-col">
                <div className="decode-emotion-contrast-label" style={{ color: 'var(--win)' }}>WIN emotions</div>
                <div className="decode-emotion-contrast-tags">
                  {emotions.win_emotions.map(id => {
                    const em = getEmotionById(id)
                    return em ? <span key={id} className="decode-emotion-chip" style={{ color: 'var(--win)', borderColor: 'var(--win)' }}>{em.emoji} {em.label}</span> : null
                  })}
                </div>
              </div>
              <div className="decode-emotion-contrast-col">
                <div className="decode-emotion-contrast-label" style={{ color: 'var(--miss)' }}>MISS emotions</div>
                <div className="decode-emotion-contrast-tags">
                  {emotions.miss_emotions.map(id => {
                    const em = getEmotionById(id)
                    return em ? <span key={id} className="decode-emotion-chip" style={{ color: 'var(--miss)', borderColor: 'var(--miss)' }}>{em.emoji} {em.label}</span> : null
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Correlations */}
      {correlations && correlations.length > 0 && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">🔗</span>
            <span className="decode-section-title">Behavior Correlations</span>
          </div>
          <div className="decode-correlations">
            {correlations.map((c, i) => (
              <div key={i} className="decode-corr-card">
                <div className="decode-corr-header">
                  <span className="decode-corr-label">{c.label}</span>
                  <div className="decode-corr-strength">
                    <div className="decode-corr-bar">
                      <div className="decode-corr-fill" style={{ width: `${c.strength * 100}%`, background: c.strength > 0.5 ? 'var(--win)' : 'var(--future)' }} />
                    </div>
                  </div>
                </div>
                <div className="decode-corr-insight">{c.insight}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day of Week Pattern */}
      {day_of_week && day_of_week.length >= 3 && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">📅</span>
            <span className="decode-section-title">Your Week Pattern</span>
          </div>

          {data.best_day && data.worst_day && data.best_day.day !== data.worst_day.day && (
            <div className="decode-day-contrast">
              <div className="decode-day-best">
                <div className="decode-day-label">Best day</div>
                <div className="decode-day-name" style={{ color: 'var(--win)' }}>{data.best_day.day}</div>
                <div className="decode-day-rate">{data.best_day.win_rate}% wins</div>
              </div>
              <div className="decode-day-vs">vs</div>
              <div className="decode-day-worst">
                <div className="decode-day-label">Weakest day</div>
                <div className="decode-day-name" style={{ color: 'var(--miss)' }}>{data.worst_day.day}</div>
                <div className="decode-day-rate">{data.worst_day.win_rate}% wins</div>
              </div>
            </div>
          )}

          <div className="decode-week-bars">
            {day_of_week.map(d => (
              <div key={d.day} className="decode-week-bar-item">
                <div className="decode-week-bar-label">{d.day.slice(0, 3)}</div>
                <div className="decode-week-bar-track">
                  <div
                    className="decode-week-bar-fill"
                    style={{
                      height: `${Math.max(d.winRate, 5)}%`,
                      background: d.winRate >= 70 ? 'var(--win)' : d.winRate >= 40 ? 'var(--future)' : 'var(--miss)',
                    }}
                  />
                </div>
                <div className="decode-week-bar-val">{d.winRate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Energy → Outcome */}
      {energy_outcome && energy_outcome.high_energy_win_rate !== null && energy_outcome.low_energy_win_rate !== null && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">⚡</span>
            <span className="decode-section-title">Energy Predicts Your Day</span>
          </div>
          <div className="decode-energy-comparison">
            <div className="decode-energy-col">
              <div className="decode-energy-label">High energy (7+)</div>
              <div className="decode-energy-rate" style={{ color: 'var(--win)' }}>
                {energy_outcome.high_energy_win_rate}%
              </div>
              <div className="decode-energy-sub">WIN rate</div>
            </div>
            <div className="decode-energy-arrow">→</div>
            <div className="decode-energy-col">
              <div className="decode-energy-label">Low energy (4-)</div>
              <div className="decode-energy-rate" style={{ color: 'var(--miss)' }}>
                {energy_outcome.low_energy_win_rate}%
              </div>
              <div className="decode-energy-sub">WIN rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Overview stats */}
      {overview && (
        <div className="decode-section">
          <div className="decode-section-header">
            <span className="decode-section-icon">📊</span>
            <span className="decode-section-title">Your Numbers</span>
          </div>
          <div className="decode-stats-grid">
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--win)' }}>{overview.win_rate}%</div>
              <div className="decode-stat-label">Win rate</div>
            </div>
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--work)' }}>{overview.avg_energy}</div>
              <div className="decode-stat-label">Avg energy</div>
            </div>
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--future)' }}>{overview.avg_focus}</div>
              <div className="decode-stat-label">Avg focus</div>
            </div>
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--body)' }}>{overview.avg_mood}</div>
              <div className="decode-stat-label">Avg mood</div>
            </div>
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--accent)' }}>{overview.all_tasks_done_rate}%</div>
              <div className="decode-stat-label">All 3 done</div>
            </div>
            <div className="decode-stat">
              <div className="decode-stat-val" style={{ color: 'var(--muted2)' }}>{overview.reflection_rate}%</div>
              <div className="decode-stat-label">Reflect rate</div>
            </div>
          </div>
        </div>
      )}

      <div className="decode-footer">
        Based on {data.days_logged} days of data. Log more for deeper insights.
      </div>
    </div>
  )
}
