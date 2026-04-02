import { useState, useEffect } from 'react'
import type { Tab } from '../types'
import { api } from '../api'
import { weekStartForOffset } from '../store'
import { parseBQDate } from '../lib/dates'
import { OUTCOME_CONFIGS } from '../data'
import { alpha } from '../lib/color'
import type { LogRow } from '../types'

interface Props {
  onDone:      () => void
  onTabChange: (t: Tab) => void
}

type Step = 'summary' | 'anchors' | 'lesson' | 'set-anchors'

export default function WeeklyReview({ onDone, onTabChange }: Props) {
  const [step,        setStep]        = useState<Step>('summary')
  const [lastWeekData,setLastWeekData]= useState<LogRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lesson,      setLesson]      = useState('')
  const [anchorRatings, setAnchorRatings] = useState<Record<string, string>>({})
  const [exiting,     setExiting]     = useState(false)

  const lastWeekStart = weekStartForOffset(-1)

  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    api.getWeek(lastWeekStart)
      .then(rows => setLastWeekData(rows))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  const next = (to: Step) => {
    setExiting(true)
    setTimeout(() => { setStep(to); setExiting(false) }, 180)
  }

  const saveReviewToLocal = () => {
    try {
      const key = 'decode_weekly_review_' + lastWeekStart
      localStorage.setItem(key, JSON.stringify({ lesson, anchorRatings, savedAt: new Date().toISOString() }))
    } catch {}
  }

  const finish = () => {
    saveReviewToLocal()
    setExiting(true)
    setTimeout(() => { onTabChange('anchors'); onDone() }, 200)
  }

  // Stats from last week
  const daysWithOutcome = lastWeekData.filter(r => r.day_outcome)
  const wins    = daysWithOutcome.filter(r => r.day_outcome === 'win').length
  const partials= daysWithOutcome.filter(r => r.day_outcome === 'partial').length
  const misses  = daysWithOutcome.filter(r => r.day_outcome === 'miss').length
  const winRate = daysWithOutcome.length > 0 ? Math.round((wins / daysWithOutcome.length) * 100) : 0

  const avgOf = (key: keyof LogRow) => {
    const vals = lastWeekData.map(r => r[key]).filter((v): v is number => typeof v === 'number' && v > 0)
    return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null
  }
  const avgEnergy = avgOf('energy_level')
  const avgFocus  = avgOf('focus_level')
  const avgMood   = avgOf('mood_level')

  const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const steps: { id: Step; label: string }[] = [
    { id: 'summary',     label: 'Last week'  },
    { id: 'anchors',     label: 'Anchors'    },
    { id: 'lesson',      label: 'Lesson'     },
    { id: 'set-anchors', label: 'Next week'  },
  ]
  const stepIdx = steps.findIndex(s => s.id === step)

  return (
    <div className="review-overlay">
      <div className="review-sheet">
        {/* Progress */}
        <div className="review-progress">
          {steps.map((s, i) => (
            <div key={s.id} className={`review-step-dot ${i <= stepIdx ? 'active' : ''}`} />
          ))}
        </div>

        <div className={`review-body ${exiting ? 'review-exit' : 'review-enter'}`}>

          {/* Step 1: Last week summary */}
          {step === 'summary' && (
            <div>
              <div className="review-eyebrow">Weekly review</div>
              <div className="review-title">How last week went</div>

              {loading ? (
                <div className="review-loading">Loading last week's data...</div>
              ) : loadError ? (
                <div className="review-no-data">Could not load last week's data — check your connection.</div>
              ) : (
                <>
                  {/* Outcome row */}
                  <div className="review-outcomes">
                    {OUTCOME_CONFIGS.map(o => {
                      const count = o.id === 'win' ? wins : o.id === 'partial' ? partials : misses
                      return (
                        <div key={o.id} className="review-outcome-box" style={{ borderColor: alpha(o.color, 25) }}>
                          <div className="review-outcome-emoji">{o.emoji}</div>
                          <div className="review-outcome-count" style={{ color: o.color }}>{count}</div>
                          <div className="review-outcome-label">{o.label}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Scores */}
                  <div className="review-scores">
                    {[
                      { label: 'Win rate', val: `${winRate}%`, color: winRate>=70?'var(--win)':winRate>=40?'var(--future)':'var(--miss)' },
                      { label: 'Energy',   val: avgEnergy ?? '—', color: 'var(--work)'   },
                      { label: 'Focus',    val: avgFocus  ?? '—', color: 'var(--future)' },
                      { label: 'Mood',     val: avgMood   ?? '—', color: 'var(--body)'   },
                    ].map(s => (
                      <div key={s.label} className="review-score-box">
                        <div className="review-score-val" style={{ color: s.color }}>{s.val}</div>
                        <div className="review-score-label">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mini week grid */}
                  <div className="review-week-grid">
                    {lastWeekData.map(r => {
                      const out = r.day_outcome
                      const dayStr = parseBQDate(r.log_date)
                      const dayIdx = new Date(dayStr + 'T12:00:00').getDay()
                      const cfg = OUTCOME_CONFIGS.find(o => o.id === out)
                      return (
                        <div key={dayStr} className="review-day-cell">
                          <div className="review-day-name">{DAYS_SHORT[dayIdx]}</div>
                          <div className="review-day-dot" style={{
                            background: cfg ? cfg.color : 'var(--border2)',
                          }}>
                            {cfg ? cfg.emoji : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {daysWithOutcome.length === 0 && (
                    <div className="review-no-data">No completed days last week — that's ok, this week is a fresh start.</div>
                  )}
                </>
              )}

              <button className="btn-primary btn-full mt-4" onClick={() => next('anchors')}>
                Next → Anchor review
              </button>
            </div>
          )}

          {/* Step 2: Anchor performance */}
          {step === 'anchors' && (
            <div>
              <div className="review-eyebrow">Step 2 of 4</div>
              <div className="review-title">How were your anchors?</div>
              <div className="review-desc">Anchors are your weekly compass — did you move toward them?</div>

              <div className="review-anchor-checks">
                {[
                  { icon: '💼', label: 'Work anchor', key: 'work' as const },
                  { icon: '🚀', label: 'Future anchor', key: 'future' as const },
                  { icon: '💪', label: 'Body anchor', key: 'body' as const },
                ].map(a => (
                  <div key={a.key} className="review-anchor-row">
                    <span className="review-anchor-icon">{a.icon}</span>
                    <span className="review-anchor-label">{a.label}</span>
                    <div className="review-anchor-rating">
                      {['✓ Yes', '~ Partial', '✗ No'].map(r => (
                        <button
                          key={r}
                          className={`review-rating-btn ${anchorRatings[a.key] === r ? 'review-rating-active' : ''}`}
                          onClick={() => setAnchorRatings(p => ({ ...p, [a.key]: r }))}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="review-btn-row">
                <button className="btn-secondary review-btn-back" onClick={() => next('summary')}>← Back</button>
                <button className="btn-primary review-btn-next" onClick={() => next('lesson')}>Next → Lesson</button>
              </div>
            </div>
          )}

          {/* Step 3: One lesson */}
          {step === 'lesson' && (
            <div>
              <div className="review-eyebrow">Step 3 of 4</div>
              <div className="review-title">What's one lesson?</div>
              <div className="review-desc">Looking at last week — what's the one thing you'd do differently, or the one thing that worked really well?</div>

              <textarea
                className="field-textarea mt-3"
                rows={4}
                value={lesson}
                onChange={e => setLesson(e.target.value)}
                placeholder="e.g. I hit WIN days when I did gym in the morning, not evening..."
                autoFocus
              />

              <div className="review-btn-row">
                <button className="btn-secondary review-btn-back" onClick={() => next('anchors')}>← Back</button>
                <button className="btn-primary review-btn-next" onClick={() => next('set-anchors')}>Next → Set anchors</button>
              </div>
            </div>
          )}

          {/* Step 4: Set anchors */}
          {step === 'set-anchors' && (
            <div>
              <div className="review-eyebrow">Step 4 of 4 — Final step</div>
              <div className="review-title">Set next week's anchors</div>
              <div className="review-desc">
                {lesson && (
                  <div className="review-lesson-callout">
                    💡 Your lesson: "{lesson}"
                  </div>
                )}
                Now set your 3 anchors for the coming week with that lesson in mind.
              </div>

              <button className="btn-primary btn-full mt-4" onClick={finish}>
                Go to Anchors tab →
              </button>
              <button className="btn-secondary btn-full-mt" onClick={() => { saveReviewToLocal(); onDone() }}>
                Skip — set anchors later
              </button>
            </div>
          )}

        </div>

        {/* Close */}
        <button className="review-close" onClick={() => { saveReviewToLocal(); onDone() }}>✕</button>
      </div>
    </div>
  )
}