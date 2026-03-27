import React from 'react'
import { useState, useEffect } from 'react'
import type { LogPayload } from '../types'
import { TASK_CATEGORIES, TASK_OPTIONS } from '../data'
import { ENERGY_LABELS } from '../data'
import { todayStr, weekStartStr, getAnchors, getTodayCache, saveTodayCache, parseBQDate } from '../store'
import { api } from '../api'

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
  const [energy,  setEnergy]  = useState<number>(cached.energy_level ?? 5)
  const [errors,  setErrors]  = useState({ work: false, future: false, body: false })
  const [loading,      setLoading]      = useState(false)
  const [syncing,      setSyncing]      = useState(true)
  const [saved,        setSaved]        = useState(false)
  const [alreadySaved, setAlreadySaved] = useState(false)  // true = BQ has today's morning log
  const [yesterdayPlan, setYesterdayPlan] = useState<string | null>(null)

  const today      = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const energyInfo = ENERGY_LABELS[energy]

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
    setDone(p => ({ ...p, [k]: !p[k] }))
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
      if (res.success) { setSaved(true); onToast('Saved to BigQuery ✓') }
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

      {/* Task cards — built from TASK_CATEGORIES data */}
      <div className="task-cards">
        {TASK_CATEGORIES.map(cat => {
          const value = taskValues[cat.key]
          const isDone = done[cat.key]
          const hasError = errors[cat.key]
          const options = TASK_OPTIONS[cat.key]

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
      <div className="card" style={{ marginBottom: 12 }}>
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
          onChange={e => { if (!alreadySaved) { setEnergy(Number(e.target.value)); setSaved(false) } }}
          className="energy-slider"
          style={{ '--thumb-color': energyInfo.color } as React.CSSProperties}
          disabled={alreadySaved}
        />
        <div className="slider-scale">
          <span>Drained</span><span>Neutral</span><span>Peak energy</span>
        </div>
      </div>

      {alreadySaved ? (
        <button className="btn-success" style={{ width: '100%' }} onClick={handleSave} disabled={loading}>
          {loading && <span className="spinner show" />}
          ✓ Update done status → BigQuery
        </button>
      ) : (
        <button
          className={saved ? 'btn-success' : 'btn-primary'}
          style={{ width: '100%' }}
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