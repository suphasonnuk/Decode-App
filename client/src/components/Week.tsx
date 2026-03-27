import { useEffect, useState } from 'react'
import type { LogRow, LogPayload } from '../types'
import { getAnchors, weekDates, getDayCache, getNightCacheForDate, todayStr, weekStartForOffset, parseBQDate } from '../store'
import { api } from '../api'
import { TASK_CATEGORIES, TASK_OPTIONS, OUTCOME_CONFIGS, DAYS_FULL, DAYS_SHORT } from '../data'

function ScoreBadge({ value, color }: { value: number | null | undefined; color: string }) {
  if (!value) return <span className="score-badge score-badge-empty">—</span>
  return (
    <span className="score-badge" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
      {value}
    </span>
  )
}

function OutcomePill({ outcome }: { outcome: string | null | undefined }) {
  if (!outcome) return <span className="outcome-pill outcome-pill-empty">—</span>
  const cfg = OUTCOME_CONFIGS.find(o => o.id === outcome)
  if (!cfg) return <span className="outcome-pill outcome-pill-empty">—</span>
  return (
    <span className="outcome-pill" style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}12` }}>
      {cfg.emoji} {cfg.shortLabel}
    </span>
  )
}

export default function Week() {
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [weekData,    setWeekData]    = useState<LogRow[]>([])
  const [streak,      setStreak]      = useState<{ current: number; longest30: number } | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [editRow,     setEditRow]     = useState<string | null>(null)
  const [editPayload, setEditPayload] = useState<Partial<LogPayload>>({})
  const [editSaving,  setEditSaving]  = useState(false)
  const [editMsg,     setEditMsg]     = useState('')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const anchors   = getAnchors()
  const weekStart = weekStartForOffset(weekOffset)
  const dates     = weekDates(weekStart)
  const today     = todayStr()
  const isCurrent = weekOffset === 0

  const fetchWeek = (offset = weekOffset) => {
    const start  = weekStartForOffset(offset)
    const isCurr = offset === 0
    setLoading(true)
    Promise.all([
      api.getWeek(offset !== 0 ? start : undefined),
      isCurr ? api.getStreak() : Promise.resolve(null),
    ])
      .then(([rows, s]) => { setWeekData(rows); if (s) setStreak(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchWeek(weekOffset) }, [weekOffset])

  const getRow = (date: string): Partial<LogRow> => {
    const serverRow = weekData.find(r => parseBQDate(r.log_date) === date)
    if (serverRow) return serverRow
    const day   = getDayCache(date)
    const night = getNightCacheForDate(date)
    return { ...day, ...(night ?? {}), day_outcome: night?.outcome ?? undefined }
  }

  const rowData = dates.map(date => ({ date, row: getRow(date) }))
  const wins    = rowData.filter(d => d.row.day_outcome === 'win').length

  const openEdit = (date: string, row: Partial<LogRow>) => {
    setEditRow(date); setEditPayload({ ...row }); setEditMsg('')
  }

  const handleEditSave = async () => {
    if (!editRow || !editPayload.work_task) { setEditMsg('Work task is required'); return }
    setEditSaving(true)
    try {
      const payload: LogPayload = {
        log_date:      editRow,
        week_start:    weekStartForOffset(weekOffset),
        work_anchor:   editPayload.work_anchor   ?? null,
        future_anchor: editPayload.future_anchor ?? null,
        body_anchor:   editPayload.body_anchor   ?? null,
        work_task:     editPayload.work_task!,
        future_task:   editPayload.future_task!,
        body_task:     editPayload.body_task!,
        work_done:     editPayload.work_done   ?? false,
        future_done:   editPayload.future_done ?? false,
        body_done:     editPayload.body_done   ?? false,
        energy_level:  editPayload.energy_level ?? 5,
        focus_level:   editPayload.focus_level  ?? null,
        mood_level:    editPayload.mood_level   ?? null,
        day_outcome:   editPayload.day_outcome  ?? null,
        tomorrow_action: editPayload.tomorrow_action ?? null,
        reflection:    editPayload.reflection   ?? null,
      }
      const res = await api.saveLog(payload)
      if (res.success) { setEditRow(null); fetchWeek(weekOffset) }
      else setEditMsg(res.error ?? 'Save failed')
    } catch (err) { setEditMsg(err instanceof Error ? err.message : 'Save failed') }
    finally { setEditSaving(false) }
  }

  const weekRangeLabel = (() => {
    const start = new Date(weekStart + 'T12:00:00')
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    const fmt   = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}`
  })()

  return (
    <div>
      {/* Streak banner */}
      {isCurrent && streak !== null && (
        <div className="streak-banner">
          <div className="streak-left">
            <div className="streak-fire">{streak.current > 0 ? '🔥' : '💤'}</div>
            <div>
              <div className="streak-count">{streak.current} day{streak.current !== 1 ? 's' : ''}</div>
              <div className="streak-label">current win streak</div>
            </div>
          </div>
          <div className="streak-right">
            <div className="streak-best-num">{streak.longest30}</div>
            <div className="streak-best-label">best in 30 days</div>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>← Prev week</button>
        <div className="week-nav-center">
          <div className="week-nav-title">{isCurrent ? 'This week' : weekOffset === -1 ? 'Last week' : `${Math.abs(weekOffset)} weeks ago`}</div>
          <div className="week-nav-range">{weekRangeLabel}</div>
        </div>
        <button className="week-nav-btn" onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={isCurrent}>Next week →</button>
      </div>

      {/* Weekly anchors */}
      {isCurrent && (anchors.work || anchors.future || anchors.body) && (
        <div className="card">
          <div className="card-label">This Week's Anchors</div>
          <div className="anchors-display">
            {TASK_CATEGORIES.filter(a => anchors[a.key]).map(a => (
              <div className="anchor-row-item" key={a.key}>
                <span className="anchor-row-icon">{a.icon}</span>
                <span className="anchor-row-text" style={{ color: a.color }}>{anchors[a.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day rows */}
      <div>
        <div className="wk-section-header">
          <span className="card-label" style={{ marginBottom: 0 }}>
            Daily Breakdown {loading && <span className="sync-spinner" />}
          </span>
          <span className="card-label-hint">Tap to expand</span>
        </div>

        {rowData.map(({ date, row }) => {
          const isFuture   = date > today
          const isToday    = date === today
          const dayIdx     = new Date(date + 'T12:00:00').getDay()
          const isExpanded = expandedDay === date
          const hasData    = !!(row.day_outcome || row.work_task)
          const outcome    = OUTCOME_CONFIGS.find(o => o.id === row.day_outcome)

          return (
            <div key={date}
              className={`wk-day-card ${isToday ? 'wk-today' : ''} ${isFuture ? 'wk-future' : ''} ${isExpanded ? 'wk-expanded' : ''}`}
              onClick={() => !isFuture && setExpandedDay(isExpanded ? null : date)}
            >
              {/* ── Row: day name + scores + outcome ── */}
              <div className="wk-row-main">

                {/* Left: day name */}
                <div className="wk-day-name-col">
                  <span className="wk-day-name">{DAYS_SHORT[dayIdx]}</span>
                  {isToday && <span className="wk-today-badge">today</span>}
                </div>

                {/* Center: task dots */}
                <div className="wk-tasks-col">
                  {TASK_CATEGORIES.map(cat => {
                    const done     = row[`${cat.key}_done` as keyof LogRow] as boolean | undefined
                    const selected = row[`${cat.key}_task` as keyof LogRow]
                    return (
                      <span
                        key={cat.key}
                        className={`task-dot ${done ? `task-dot-${cat.key}` : selected ? 'task-dot-selected' : 'task-dot-empty'}`}
                        title={cat.label}
                      />
                    )
                  })}
                </div>

                {/* Scores: three chips */}
                <div className="wk-scores-col">
                  {[
                    { val: row.energy_level, color: 'var(--work)',   label: '⚡' },
                    { val: row.focus_level,  color: 'var(--future)', label: '🎯' },
                    { val: row.mood_level,   color: 'var(--body)',   label: '😊' },
                  ].map(s => (
                    <span key={s.label}
                      className="wk-score-chip"
                      style={{ color: s.val ? s.color : 'var(--muted)', background: s.val ? `${s.color}12` : 'transparent' }}
                    >
                      {s.val ?? '—'}
                    </span>
                  ))}
                </div>

                {/* Right: outcome */}
                <div className="wk-outcome-col">
                  {isFuture
                    ? <span className="wk-outcome-empty">—</span>
                    : outcome
                      ? <span className="wk-outcome-pill" style={{ color: outcome.color, background: `${outcome.color}14`, borderColor: `${outcome.color}35` }}>
                          {outcome.emoji} <span className="wk-outcome-label">{outcome.shortLabel}</span>
                        </span>
                      : <span className="wk-outcome-empty">—</span>
                  }
                </div>
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && hasData && (
                <div className="wk-expand" onClick={e => e.stopPropagation()}>
                  <div className="wk-expand-tasks">
                    {TASK_CATEGORIES.map(cat => {
                      const taskVal = row[`${cat.key}_task` as keyof LogRow] as string | undefined
                      const isDone  = row[`${cat.key}_done` as keyof LogRow] as boolean | undefined
                      if (!taskVal) return null
                      return (
                        <div className="wk-expand-task" key={cat.key}>
                          <span className="wk-expand-task-icon">{cat.icon}</span>
                          <span className="wk-expand-task-text"
                            style={{ color: cat.color, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.55 : 1 }}
                          >
                            {taskVal}
                          </span>
                          {isDone && <span className="wk-expand-done">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                  {row.tomorrow_action && (
                    <div className="wk-expand-plan">
                      <span className="wk-expand-plan-label">📌 Tomorrow</span>
                      <span className="wk-expand-plan-text">{row.tomorrow_action}</span>
                    </div>
                  )}
                  {row.reflection && (
                    <div className="wk-expand-reflection">💭 {row.reflection}</div>
                  )}
                  {row.day_outcome && (
                    <button className="wk-edit-btn" onClick={() => openEdit(date, row)}>
                      ✏️ Edit this day
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

      </div>

      {/* Week summary */}
      <div className="card">
        <div className="week-summary">
          <div className="week-summary-stat">
            <span className="week-summary-num" style={{ color: 'var(--win)' }}>{wins}</span>
            <span className="week-summary-label">win days</span>
          </div>
          {TASK_CATEGORIES.map(cat => (
            <div className="week-summary-stat" key={cat.key}>
              <span className="week-summary-num" style={{ color: cat.color }}>
                {rowData.filter(d => d.row[`${cat.key}_done` as keyof LogRow]).length}
              </span>
              <span className="week-summary-label">{cat.key} done</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editRow && (
        <div className="modal-overlay" onClick={() => setEditRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit — {DAYS_FULL[new Date(editRow + 'T12:00:00').getDay()]}, {editRow}</div>
              <button className="modal-close" onClick={() => setEditRow(null)}>✕</button>
            </div>
            <div className="modal-body">
              {TASK_CATEGORIES.map(cat => {
                const key = `${cat.key}_task` as 'work_task' | 'future_task' | 'body_task'
                return (
                  <div className="modal-field" key={cat.key}>
                    <label>{cat.icon} {cat.label}</label>
                    <select
                      value={(editPayload as any)[key] ?? ''}
                      onChange={e => setEditPayload(p => ({ ...p, [key]: e.target.value }))}
                    >
                      {TASK_OPTIONS[cat.key].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )
              })}
              <div className="modal-field">
                <label>Result</label>
                <div className="outcome-row-small">
                  {OUTCOME_CONFIGS.map(o => (
                    <button
                      key={o.id}
                      className={`outcome-btn-small ${editPayload.day_outcome === o.id ? 'active' : ''}`}
                      onClick={() => setEditPayload(p => ({ ...p, day_outcome: o.id }))}
                    >
                      {o.emoji} {o.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
              {editMsg && <div className="field-error">{editMsg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditRow(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleEditSave} disabled={editSaving}>
                {editSaving && <span className="spinner show" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}