import React, { useState, useEffect } from 'react'
import type { DayOutcome, LogPayload } from '../types'
import { OUTCOME_CONFIGS, NIGHT_SLIDER_CONFIGS, getSliderLabel } from '../data'
import { todayStr, weekStartStr, getAnchors, getTodayCache, getNightCache, saveNightCache, saveTodayCache } from '../store'
import { api } from '../api'
import Confetti from './Confetti'
import { hapticMedium, hapticSuccess } from '../lib/haptics'

interface Props { onToast: (msg: string, err?: boolean) => void }

export default function Night({ onToast }: Props) {
  const cached = getNightCache()

  const [outcome,    setOutcome]    = useState<DayOutcome | null>(cached.outcome)
  const [focus,      setFocus]      = useState<number>(cached.focus_level)
  const [mood,       setMood]       = useState<number>(cached.mood_level)
  const [tomorrow,   setTomorrow]   = useState<string>(cached.tomorrow_action)
  const [reflection, setReflection] = useState<string>(cached.reflection)
  const [errors,     setErrors]     = useState({ outcome: false, tomorrow: false })
  const [loading,      setLoading]      = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [alreadySaved, setAlreadySaved] = useState(false)  // true = BQ has today's night log
  const [todayFilled, setTodayFilled] = useState<boolean>(
    !!(getTodayCache().work_task && getTodayCache().future_task && getTodayCache().body_task)
  )

  // Cross-device check — if local cache empty, check BigQuery
  useEffect(() => {
    api.getToday()
      .then(row => {
        if (!row) return
        if (row.work_task && row.future_task && row.body_task) {
          setTodayFilled(true)
          saveTodayCache({
            work_task: row.work_task, future_task: row.future_task, body_task: row.body_task,
            work_done: row.work_done, future_done: row.future_done, body_done: row.body_done,
            energy_level: row.energy_level,
          })
        }
        // If night log already saved to BQ, lock the form
        if (row.day_outcome) {
          setOutcome(row.day_outcome as any)
          if (row.focus_level)     setFocus(row.focus_level)
          if (row.mood_level)      setMood(row.mood_level)
          if (row.tomorrow_action) setTomorrow(row.tomorrow_action)
          if (row.reflection)      setReflection(row.reflection)
          setAlreadySaved(true)
          setSaved(true)
        }
      })
      .catch(() => {})
  }, [])

  const validate = (): boolean => {
    const e = { outcome: !outcome, tomorrow: !tomorrow.trim() }
    setErrors(e)
    return !e.outcome && !e.tomorrow
  }

  const handleSave = async () => {
    if (!todayFilled) { onToast('Go to TODAY tab first and fill in your tasks', true); return }
    if (!validate())  { onToast('Please fill all required fields', true); return }

    const freshDay = getTodayCache()
    const anch     = getAnchors()
    const payload: LogPayload = {
      log_date:      todayStr(),
      week_start:    weekStartStr(),
      work_anchor:   anch.work   || freshDay.work_anchor   || null,
      future_anchor: anch.future || freshDay.future_anchor || null,
      body_anchor:   anch.body   || freshDay.body_anchor   || null,
      work_task:     freshDay.work_task!,
      future_task:   freshDay.future_task!,
      body_task:     freshDay.body_task!,
      work_done:     freshDay.work_done   ?? false,
      future_done:   freshDay.future_done ?? false,
      body_done:     freshDay.body_done   ?? false,
      energy_level:  freshDay.energy_level ?? 5,
      focus_level:   focus,
      mood_level:    mood,
      day_outcome:   outcome,
      tomorrow_action: tomorrow.trim(),
      reflection:    reflection.trim() || null,
    }
    saveNightCache({ outcome, focus_level: focus, mood_level: mood, tomorrow_action: tomorrow.trim(), reflection: reflection.trim() })
    setLoading(true)
    try {
      const res = await api.saveLog(payload)
      if (res.success) { setSaved(true); hapticSuccess(); onToast('Day closed & saved ✓') }
      else onToast('Error: ' + (res.error ?? 'Unknown'), true)
    } catch (err) {
      onToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'), true)
    } finally { setLoading(false) }
  }

  return (
    <div>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="page-intro">
        <div className="page-intro-title">Close the Day</div>
        <div className="page-intro-sub">Quick reflection before sleep</div>
      </div>

      {/* ── Already saved banner ── */}
      {alreadySaved && (
        <div className="day-locked-banner day-locked-night">
          <span className="day-locked-icon">🌙</span>
          <div className="day-locked-body">
            <div className="day-locked-title">Day already closed</div>
            <div className="day-locked-sub">Tonight's log is saved in BigQuery. Resets at midnight for tomorrow.</div>
          </div>
        </div>
      )}

      {!todayFilled && !alreadySaved && (
        <div className="warning-banner">
          <span>⚠️</span>
          <span>You haven't filled in TODAY's tasks yet. Go to the TODAY tab first, then come back here.</span>
        </div>
      )}

      {/* Step 1 — Outcome */}
      <div className="card">
        <div className="card-label">How was today? <span className="req">*</span></div>
        <div className="outcome-cards">
          {OUTCOME_CONFIGS.map(o => (
            <button
              key={o.id}
              className={`outcome-card ${outcome === o.id ? 'outcome-card-active' : ''} ${errors.outcome ? 'outcome-card-error' : ''}${alreadySaved ? ' outcome-card-locked' : ''}`}
              style={{ '--outcome-color': o.color } as React.CSSProperties}
              onClick={() => {
                if (alreadySaved) return
                setOutcome(o.id)
                setErrors(p => ({ ...p, outcome: false }))
                setSaved(false)
                hapticMedium()
                if (o.id === 'win') setShowConfetti(true)
              }}
              disabled={alreadySaved}
            >
              <span className="outcome-card-emoji">{o.emoji}</span>
              <span className="outcome-card-label" style={{ color: outcome === o.id ? o.color : undefined }}>{o.label}</span>
              <span className="outcome-card-desc">{o.desc}</span>
            </button>
          ))}
        </div>
        {errors.outcome && <div className="field-error">Please select how today went</div>}
      </div>

      {/* Step 2 — Focus & Mood sliders */}
      <div className="card">
        <div className="card-label">Rate Your Day</div>
        {NIGHT_SLIDER_CONFIGS.map(cfg => {
          const val = cfg.key === 'focus' ? focus : mood
          const set = cfg.key === 'focus' ? setFocus : setMood
          const col = cfg.color(val)
          return (
            <div className="slider-block" key={cfg.key}>
              <div className="slider-block-header">
                <div>
                  <div className="slider-block-label">{cfg.label}</div>
                  <div className="slider-block-desc">{cfg.desc}</div>
                </div>
                <div className="slider-block-value" style={{ color: col }}>
                  <span className="slider-num">{val}</span>
                  <span className="slider-max">/10</span>
                </div>
              </div>
              <input
                type="range" min={1} max={10} value={val}
                onChange={e => { set(Number(e.target.value)); setSaved(false) }}
                className="energy-slider"
                style={{ '--thumb-color': col } as React.CSSProperties}
              />
              <div className="slider-reading" style={{ color: col }}>
                {getSliderLabel(cfg.levels, val)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 3 — Tomorrow's plan */}
      <div className="card">
        <div className="card-label">Plan Tomorrow <span className="req">*</span></div>
        <p className="field-hint">Write your very first action tomorrow morning. Be specific — this will appear at the top of your TODAY tab tomorrow.</p>
        <textarea
          className={`field-textarea ${errors.tomorrow ? 'field-textarea-error' : ''}`}
          rows={2}
          value={tomorrow}
          onChange={e => { setTomorrow(e.target.value); setErrors(p => ({ ...p, tomorrow: false })); setSaved(false) }}
          placeholder='e.g. "I will review the CMG pipeline report at 9am"'
        />
        {errors.tomorrow && <div className="field-error">Please write your first action for tomorrow</div>}
      </div>

      {/* Step 4 — Reflection (optional) */}
      <div className="card">
        <div className="card-label">Reflection <span className="optional-badge">optional</span></div>
        <p className="field-hint">2–3 sentences max. What happened? Any insight? Saved to BigQuery as your personal journal.</p>
        <textarea
          className="field-textarea"
          rows={3}
          value={reflection}
          onChange={e => { setReflection(e.target.value); setSaved(false) }}
          placeholder="What was notable about today? Any lesson learned?"
        />
      </div>

      <button
        className="btn-success"
        style={{ width: '100%' }}
        onClick={handleSave}
        disabled={loading || !todayFilled || alreadySaved}
      >
        {loading && <span className="spinner show" />}
        {alreadySaved ? '✓ Day Closed & Saved' : saved ? '✓ Day Closed & Saved' : 'Close the Day → BigQuery'}
      </button>
    </div>
  )
}