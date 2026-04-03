import React, { useCallback } from 'react'
import { useState, useEffect, useRef } from 'react'
import type { LogPayload } from '../types'
import { TASK_CATEGORIES, TASK_OPTIONS, ENERGY_LABELS, todayMotivation } from '../data'
import { todayStr, weekStartStr, getAnchors, getTodayCache, saveTodayCache, parseBQDate, bumpTaskFreq, sortedTaskOptions } from '../store'
import { api } from '../api'
import { hapticMedium, hapticSuccess } from '../lib/haptics'

// ── Focus Timer (Pomodoro) ────────────────────────────────────────────────────
function FocusTimer() {
  const WORK_MINS = 25
  const BREAK_MINS = 5
  const [secondsLeft, setSecondsLeft] = useState(WORK_MINS * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isBreakRef = useRef(isBreak)
  isBreakRef.current = isBreak
  const totalSeconds = isBreak ? BREAK_MINS * 60 : WORK_MINS * 60

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (!isBreakRef.current) {
              setSessions(s => s + 1)
              setIsBreak(true)
              return BREAK_MINS * 60
            } else {
              setIsBreak(false)
              setIsRunning(false)
              return WORK_MINS * 60
            }
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning])

  const toggleTimer = useCallback(() => setIsRunning(r => !r), [])
  const resetTimer = useCallback(() => {
    setIsRunning(false)
    setIsBreak(false)
    setSecondsLeft(WORK_MINS * 60)
  }, [])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const progress = 1 - secondsLeft / totalSeconds
  const r = 50, circumference = 2 * Math.PI * r

  return (
    <div className="card focus-timer-card">
      <div className="card-label">Focus Timer</div>
      <div className="focus-timer-display">
        <div className="focus-timer-ring">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border2)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r={r} fill="none"
              stroke={isBreak ? 'var(--body)' : 'var(--accent)'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - progress)}`}
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          <div className="focus-timer-time">
            <div className="focus-timer-digits" style={{ color: isBreak ? 'var(--body)' : 'var(--accent)' }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div className="focus-timer-phase">{isBreak ? 'Break' : 'Focus'}</div>
          </div>
        </div>
        <div className="focus-timer-btns">
          <button className={`focus-timer-btn ${!isRunning ? 'focus-timer-btn-primary' : ''}`} onClick={toggleTimer}>
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button className="focus-timer-btn" onClick={resetTimer}>Reset</button>
        </div>
        <div className="focus-timer-sessions">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`focus-timer-dot ${i < sessions ? 'focus-timer-dot-done' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

interface Props { onToast: (msg: string, err?: boolean) => void }
type DoneState = { work: boolean; future: boolean; body: boolean }
type TaskKey   = 'work' | 'future' | 'body'

export default function Today({ onToast }: Props) {
  const cached = getTodayCache()

  const [taskValues, setTaskValues] = useState<Record<TaskKey, string>>({
    work:   cached.work_task   ?? '',
    future: cached.future_task ?? '',
    body:   cached.body_task   ?? '',
  })
  const [done, setDone]     = useState<DoneState>({
    work:   cached.work_done   ?? false,
    future: cached.future_done ?? false,
    body:   cached.body_done   ?? false,
  })

  // Track which task keys are in custom-input mode
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({ work: false, future: false, body: false })  
  const [intention, setIntention] = useState<string>(() => {
    try { return localStorage.getItem('decode_intention_' + todayStr()) ?? '' } catch { return '' }
  })
  const [energy,  setEnergy]  = useState<number>(cached.energy_level ?? 5)
  const [errors,  setErrors]  = useState({ work: false, future: false, body: false })
  const [loading,      setLoading]      = useState(false)
  const [syncing,      setSyncing]      = useState(true)
  const [saved,        setSaved]        = useState(false)
  const [alreadySaved, setAlreadySaved] = useState(false)  // true = BQ has today's morning log
  const [yesterdayPlan, setYesterdayPlan] = useState<string | null>(null)

  const today      = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const energyInfo = ENERGY_LABELS[energy]
  const motivation = todayMotivation()

  useEffect(() => {
    api.getYesterday().then(r => setYesterdayPlan(r.tomorrow_action)).catch(() => {})
    api.getToday()
      .then(row => {
        if (!row) return
        if (parseBQDate(row.log_date) !== todayStr()) return
        // Populate fields from BQ
        setTaskValues({ work: row.work_task ?? '', future: row.future_task ?? '', body: row.body_task ?? '' })
        setDone({ work: row.work_done ?? false, future: row.future_done ?? false, body: row.body_done ?? false })
        setEnergy(row.energy_level ?? 5)
        // Mark as already saved — morning log exists in BQ for today
        setAlreadySaved(true)
        setSaved(true)
        // Also keep local cache in sync
        saveTodayCache({
          work_task: row.work_task, future_task: row.future_task, body_task: row.body_task,
          work_done: row.work_done, future_done: row.future_done, body_done: row.body_done,
          energy_level: row.energy_level,
        })
      })
      .catch(() => {})
      .finally(() => setSyncing(false))
  }, [])

  const setTaskValue = (key: TaskKey, val: string) => {
    setTaskValues(p => ({ ...p, [key]: val }))
    setErrors(p => ({ ...p, [key]: false }))
    setSaved(false)
  }

  const toggleDone = (k: TaskKey) => {
    const next = !done[k]
    setDone(p => ({ ...p, [k]: next }))
    if (next) hapticMedium()
    setSaved(false)
  }

  const validate = (): boolean => {
    const e = {
      work:   !taskValues.work,
      future: !taskValues.future,
      body:   !taskValues.body,
    }
    setErrors(e)
    return !e.work && !e.future && !e.body
  }

  const handleSave = async () => {
    if (!validate()) { onToast('Please select all 3 tasks before saving', true); return }
    const anch = getAnchors()
    const payload: LogPayload = {
      log_date: todayStr(), week_start: weekStartStr(),
      work_anchor:   anch.work   || null,
      future_anchor: anch.future || null,
      body_anchor:   anch.body   || null,
      work_task:     taskValues.work,
      future_task:   taskValues.future,
      body_task:     taskValues.body,
      work_done:     done.work,
      future_done:   done.future,
      body_done:     done.body,
      energy_level:  energy,
    }
    saveTodayCache(payload)
    setLoading(true)
    try {
      const res = await api.saveLog(payload)
      if (res.success) { setSaved(true); hapticSuccess(); onToast('Saved to BigQuery ✓') }
      else onToast('Error: ' + (res.error ?? 'Unknown'), true)
    } catch (err) {
      onToast('Error: ' + (err instanceof Error ? err.message : 'Unknown'), true)
    } finally { setLoading(false) }
  }

  const selectedCount  = Object.values(taskValues).filter(Boolean).length
  const completedCount = Object.values(done).filter(Boolean).length

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">{today}</div>
        <div className="page-intro-sub">
          {selectedCount === 3
            ? `${completedCount}/3 tasks completed`
            : `Select ${3 - selectedCount} more task${3 - selectedCount !== 1 ? 's' : ''} to continue`}
          {syncing && <span className="sync-spinner" />}
        </div>
        <div className="motivation-line">{motivation}</div>
      </div>

      {/* ── Already saved banner ── */}
      {alreadySaved && (
        <div className="day-locked-banner">
          <span className="day-locked-icon">✅</span>
          <div className="day-locked-body">
            <div className="day-locked-title">Morning log saved</div>
            <div className="day-locked-sub">Tasks and energy saved to BigQuery. You can still tick tasks as Done.</div>
          </div>
        </div>
      )}

      {/* Yesterday's plan */}
      {yesterdayPlan && (
        <div className="yesterday-banner">
          <div className="yesterday-banner-label">📌 Your plan for today</div>
          <div className="yesterday-banner-text">"{yesterdayPlan}"</div>
        </div>
      )}

      {/* Morning intention */}
      <div className="card intention-card">
        <div className="card-label">Morning Intention</div>
        <div className="intention-prompt">
          <span className="intention-prompt-icon">🎯</span>
          <span className="intention-prompt-text">What's your #1 intention for today?</span>
        </div>
        <textarea
          className="field-textarea"
          rows={2}
          value={intention}
          onChange={e => {
            setIntention(e.target.value)
            try { localStorage.setItem('decode_intention_' + todayStr(), e.target.value) } catch {}
          }}
          placeholder="e.g. Stay focused on the quarterly report and finish by 3pm"
          disabled={alreadySaved}
        />
      </div>

      {/* Task cards — built from TASK_CATEGORIES data */}
      <div className="task-cards">
        {TASK_CATEGORIES.map(cat => {
          const value = taskValues[cat.key]
          const isDone = done[cat.key]
          const hasError = errors[cat.key]
          const options = sortedTaskOptions(cat.key, TASK_OPTIONS[cat.key])

          return (
            <div
              key={cat.key}
              className={`task-card ${hasError ? 'task-card-error' : ''} ${value ? 'task-card-filled' : ''}`}
            >
              <div className="task-card-header">
                <div className="task-card-left">
                  <span className="task-card-icon">{cat.icon}</span>
                  <span className="task-card-label" style={{ color: cat.color }}>{cat.label}</span>
                </div>
                <button
                  className={`done-btn ${isDone ? 'done-btn-active' : ''}`}
                  onClick={() => toggleDone(cat.key)}
                >
                  {isDone ? '✓ Done' : 'Mark done'}
                </button>
              </div>
              <select
                value={customMode[cat.key] || (!options.includes(value as any) && value !== '') ? 'custom' : value}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    setCustomMode(prev => ({ ...prev, [cat.key]: true }))
                    setTaskValue(cat.key, '')
                  } else {
                    setCustomMode(prev => ({ ...prev, [cat.key]: false }))
                    setTaskValue(cat.key, e.target.value)
                    bumpTaskFreq(cat.key, e.target.value)
                  }
                }}
                className={`task-select ${value ? 'task-select-filled' : ''}`}
                style={{ borderLeftColor: value ? cat.color : undefined }}
              >
                <option value="">— Choose a {cat.label.toLowerCase()} —</option>
                {options.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="custom">✏️ Custom — type my own</option>
              </select>
              {/* Show text input when custom is active */}
              {(customMode[cat.key] || (value !== '' && !options.includes(value as any))) && (
                <input
                  className="task-custom-input"
                  style={{ borderLeftColor: cat.color }}
                  value={value}
                  onChange={e => { if (!alreadySaved) { setTaskValue(cat.key, e.target.value); setSaved(false) } }}
                  disabled={alreadySaved}
                  placeholder={`Type your custom ${cat.label.toLowerCase()}...`}
                  autoFocus
                />
              )}
              {hasError && <div className="field-error">Please select a {cat.label.toLowerCase()}</div>}
            </div>
          )
        })}
      </div>

      {/* Energy slider */}
      <div className="card mb-3">
        <div className="card-label">Morning Energy Check</div>
        <div className="energy-display">
          <span className="energy-emoji">{energyInfo.emoji}</span>
          <div className="energy-info">
            <div className="energy-score" style={{ color: energyInfo.color }}>
              {energy}<span className="energy-max">/10</span>
            </div>
            <div className="energy-label" style={{ color: energyInfo.color }}>{energyInfo.label}</div>
          </div>
        </div>
        <input
          type="range" min={1} max={10} value={energy}
          onChange={e => { setEnergy(Number(e.target.value)); setSaved(false) }}
          className="energy-slider"
          style={{ '--thumb-color': energyInfo.color } as React.CSSProperties}
        />
        <div className="slider-scale">
          <span>Drained</span><span>Neutral</span><span>Peak energy</span>
        </div>
      </div>

      {/* Focus Timer */}
      <FocusTimer />

      {alreadySaved ? (
        <button className="btn-success btn-full" onClick={handleSave} disabled={loading}>
          {loading && <span className="spinner show" />}
          ✓ Update done status → BigQuery
        </button>
      ) : (
        <button
          className={`${saved ? 'btn-success' : 'btn-primary'} btn-full`}
          onClick={handleSave}
          disabled={loading}
        >
          {loading && <span className="spinner show" />}
          {saved ? '✓ Saved to BigQuery' : 'Save Today → BigQuery'}
        </button>
      )}

      {selectedCount === 3 && !saved && !alreadySaved && (
        <p className="save-hint">Tip: come back later to tick "Done" as you complete tasks</p>
      )}
    </div>
  )
}