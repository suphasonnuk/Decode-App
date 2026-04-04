import React, { useEffect, useState, useMemo } from 'react'
import type { TrendPoint } from '../types'
import { parseBQDate } from '../store'
import { api } from '../api'

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function avg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v != null)
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
}

function trend(arr: (number | null)[]): 'up' | 'down' | 'stable' {
  const vals = arr.filter((v): v is number => v != null)
  if (vals.length < 4) return 'stable'
  const first = vals.slice(0, Math.floor(vals.length / 2))
  const last  = vals.slice(Math.floor(vals.length / 2))
  const diff  = (avg(last) ?? 0) - (avg(first) ?? 0)
  if (diff >  0.5) return 'up'
  if (diff < -0.5) return 'down'
  return 'stable'
}

function trendLabel(t: 'up' | 'down' | 'stable', metric: string): string {
  if (t === 'up')     return `Your ${metric} has been improving lately`
  if (t === 'down')   return `Your ${metric} has been dipping recently — watch this`
  return `Your ${metric} is steady`
}

function scoreColor(v: number | null): string {
  if (v == null) return 'var(--muted2)'
  if (v >= 8) return 'var(--win)'
  if (v >= 6) return 'var(--future)'
  if (v >= 4) return 'var(--partial)'
  return 'var(--miss)'
}

function scoreLabel(v: number | null): string {
  if (v == null) return '—'
  if (v >= 9) return 'Excellent'
  if (v >= 7) return 'Good'
  if (v >= 5) return 'Okay'
  if (v >= 3) return 'Low'
  return 'Very low'
}

function Sparkline({ data, color, height = 56 }: { data: (number | null)[], color: string, height?: number }) {
  const W = 280
  const points = data.map((v, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * W : W / 2,
    y: v != null ? height - ((v / 10) * (height - 10)) - 5 : null,
    v,
  }))
  const segments: string[] = []
  let cur = ''
  for (const p of points) {
    if (p.y == null) { if (cur) { segments.push(cur); cur = '' } continue }
    cur += cur ? ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  if (cur) segments.push(cur)
  const avgVal = avg(data)
  const avgY   = avgVal != null ? height - ((avgVal / 10) * (height - 10)) - 5 : null
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }}>
      {[3, 5, 7].map(v => {
        const y = height - ((v / 10) * (height - 10)) - 5
        return <line key={v} x1={0} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
      })}
      {avgY != null && <line x1={0} y1={avgY} x2={W} y2={avgY} stroke={color} strokeWidth={0.5} strokeDasharray="4 2" opacity={0.4} />}
      {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
      {points.filter(p => p.y != null).map((p, i) => <circle key={i} cx={p.x} cy={p.y!} r={2.5} fill={color} />)}
    </svg>
  )
}

type HeatmapMetric = 'energy' | 'focus' | 'mood'

// Module-scope constants — never change between renders
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const HEATMAP_COLORS: Record<HeatmapMetric, string> = {
  energy: '64% 0.15 230',  // deeper blue — more saturated for better visibility
  focus:  '66% 0.16 60',   // warm amber — matches future pillar tone
  mood:   '62% 0.15 150',  // fresh green — matches body pillar tone
}
function cellColor(val: number | null, metric: HeatmapMetric): string {
  if (val == null) return 'var(--border)'
  const c = HEATMAP_COLORS[metric]
  if (val >= 9) return `oklch(${c})`
  if (val >= 7) return `oklch(${c} / 0.7)`
  if (val >= 5) return `oklch(${c} / 0.4)`
  if (val >= 3) return `oklch(${c} / 0.2)`
  return `oklch(${c} / 0.1)`
}

function Heatmap({ points }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<HeatmapMetric>('energy')
  const metricKey = metric === 'energy' ? 'energy_level' : metric === 'focus' ? 'focus_level' : 'mood_level'

  // Recompute the 90-day grid only when points or metric changes
  const { weeks } = useMemo(() => {
    const dataMap: Record<string, number | null> = {}
    for (const p of points) {
      dataMap[p.log_date] = p[metricKey]
    }
    const today = new Date()
    const days: { date: string; val: number | null; dayOfWeek: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = localDateStr(d)
      days.push({ date: dateStr, val: dataMap[dateStr] ?? null, dayOfWeek: d.getDay() })
    }
    const weeks: typeof days[] = []
    let currentWeek: typeof days = []
    for (const day of days) {
      if (day.dayOfWeek === 0 && currentWeek.length > 0) { weeks.push(currentWeek); currentWeek = [] }
      currentWeek.push(day)
    }
    if (currentWeek.length > 0) weeks.push(currentWeek)
    return { weeks }
  }, [points, metricKey])

  const cellSize = 14
  const gap = 2
  const svgWidth = weeks.length * (cellSize + gap) + 20
  const svgHeight = 7 * (cellSize + gap) + 4

  return (
    <div className="card">
      <div className="chart-header">
        <div>
          <div className="chart-title">Activity Heatmap</div>
          <div className="chart-insight">Last 90 days</div>
        </div>
        <div className="heatmap-metric-btns">
          {(['energy', 'focus', 'mood'] as HeatmapMetric[]).map(m => (
            <button
              key={m}
              className={`heatmap-metric-btn ${metric === m ? 'heatmap-metric-active' : ''}`}
              onClick={() => setMetric(m)}
              style={{ '--hm-color': m === 'energy' ? 'var(--work)' : m === 'focus' ? 'var(--future)' : 'var(--body)' } as React.CSSProperties}
            >
              {m === 'energy' ? '⚡' : m === 'focus' ? '🎯' : '😊'}
            </button>
          ))}
        </div>
      </div>
      <div className="heatmap-scroll">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: svgHeight, display: 'block' }}>
          {/* Day labels */}
          {[1, 3, 5].map(d => (
            <text key={d} x={0} y={d * (cellSize + gap) + cellSize - 3} fontSize={8} fill="var(--muted)">{DAY_LABELS[d]}</text>
          ))}
          {/* Cells */}
          {weeks.map((week, wi) => (
            week.map(day => (
              <rect
                key={day.date}
                x={20 + wi * (cellSize + gap)}
                y={day.dayOfWeek * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={cellColor(day.val, metric)}
                style={{ transition: 'fill 0.2s' }}
              >
                <title>{day.date}: {day.val ?? 'no data'}</title>
              </rect>
            ))
          ))}
        </svg>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        {[null, 2, 4, 6, 8, 10].map((v, i) => (
          <div key={i} className="heatmap-legend-cell" style={{ background: cellColor(v, metric) }} />
        ))}
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  )
}

export default function Trends() {
  const [points, setPoints] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTrends()
      .then(data => setPoints(data.map(p => ({ ...p, log_date: parseBQDate(p.log_date) }))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="empty-state">
      <div className="empty-state-icon">⏳</div>
      <div className="empty-state-title">Loading your data...</div>
    </div>
  )

  if (points.length < 2) return (
    <div className="empty-state">
      <div className="empty-state-icon">📈</div>
      <div className="empty-state-title">Not enough data yet</div>
      <div className="empty-state-desc">Complete at least 3–4 days of morning + night logs to see your trends. Come back soon.</div>
    </div>
  )

  const { daysLogged, winCount, winRate, weekBars, charts } = useMemo(() => {
    const energy  = points.map(p => p.energy_level)
    const focus   = points.map(p => p.focus_level)
    const mood    = points.map(p => p.mood_level)
    const avgEnergy = avg(energy)
    const avgFocus  = avg(focus)
    const avgMood   = avg(mood)
    const daysLogged = points.filter(p => p.day_outcome).length
    const winCount   = points.filter(p => p.day_outcome === 'win').length
    const winRate    = daysLogged > 0 ? Math.round((winCount / daysLogged) * 100) : 0
    const weeksMap: Record<string, { total: number, wins: number, label: string }> = {}
    for (const p of points) {
      const d = new Date(p.log_date + 'T12:00:00')
      d.setDate(d.getDate() - d.getDay())
      const wk = localDateStr(d)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!weeksMap[wk]) weeksMap[wk] = { total: 0, wins: 0, label }
      if (p.day_outcome) { weeksMap[wk].total++; if (p.day_outcome === 'win') weeksMap[wk].wins++ }
    }
    const weekBars = Object.entries(weeksMap).sort(([a],[b]) => a.localeCompare(b)).slice(-8)
    const charts = [
      { label: 'Energy', icon: '⚡', data: energy, color: 'var(--work)',   val: avgEnergy },
      { label: 'Focus',  icon: '🎯', data: focus,  color: 'var(--future)', val: avgFocus  },
      { label: 'Mood',   icon: '😊', data: mood,   color: 'var(--body)',   val: avgMood   },
    ]
    return { daysLogged, winCount, winRate, weekBars, charts }
  }, [points])

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">Your Trends</div>
        <div className="page-intro-sub">Last 30 days · {daysLogged} days logged</div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid">
        {charts.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-card-icon">{c.icon}</div>
            <div className="stat-card-num" style={{ color: scoreColor(c.val) }}>
              {c.val ?? '—'}
            </div>
            <div className="stat-card-label">{c.label}</div>
            <div className="stat-card-sublabel" style={{ color: scoreColor(c.val) }}>
              {scoreLabel(c.val)}
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-card-icon">🏆</div>
          <div className="stat-card-num" style={{ color: winRate >= 70 ? 'var(--win)' : winRate >= 40 ? 'var(--partial)' : 'var(--miss)' }}>
            {winRate}%
          </div>
          <div className="stat-card-label">Win rate</div>
          <div className="stat-card-sublabel" style={{ color: winRate >= 70 ? 'var(--win)' : winRate >= 40 ? 'var(--partial)' : 'var(--miss)' }}>
            {winCount}/{daysLogged} days
          </div>
        </div>
      </div>

      {/* Charts */}
      {charts.map(c => (
        <div className="card" key={c.label}>
          <div className="chart-header">
            <div>
              <div className="chart-title">{c.icon} {c.label}</div>
              <div className="chart-insight">{trendLabel(trend(c.data), c.label.toLowerCase())}</div>
            </div>
            <div className="chart-avg" style={{ color: c.color }}>
              avg {c.val ?? '—'}
            </div>
          </div>
          <Sparkline data={c.data} color={c.color} />
          <div className="chart-x-labels">
            <span>{points[0]?.log_date.slice(5)}</span>
            <span style={{color:'var(--muted)'}}>— avg</span>
            <span>{points[points.length - 1]?.log_date.slice(5)}</span>
          </div>
          <div className="chart-scale-labels">
            <span>1 = {c.label === 'Energy' ? 'Drained' : c.label === 'Focus' ? 'Scattered' : 'Very low'}</span>
            <span>10 = {c.label === 'Energy' ? 'Peak energy' : c.label === 'Focus' ? 'Deep focus' : 'Excellent'}</span>
          </div>
        </div>
      ))}

      {/* Heatmap */}
      <Heatmap points={points} />

      {/* Win rate by week */}
      <div className="card">
        <div className="chart-header">
          <div>
            <div className="chart-title">🏆 Win Rate by Week</div>
            <div className="chart-insight">
              {winRate >= 70 ? 'Strong consistency — keep this up' :
               winRate >= 40 ? 'Room to improve — aim for 70%+' :
               'Focus on completing at least one key task per day'}
            </div>
          </div>
          <div className="chart-avg" style={{ color: winRate >= 70 ? 'var(--win)' : winRate >= 40 ? 'var(--partial)' : 'var(--miss)' }}>
            {winRate}% avg
          </div>
        </div>
        <div className="winrate-chart">
          {weekBars.map(([wk, { total, wins: w, label }]) => {
            const pct = total > 0 ? Math.round((w / total) * 100) : 0
            const col = pct >= 70 ? 'var(--win)' : pct >= 40 ? 'var(--partial)' : 'var(--miss)'
            return (
              <div className="winrate-bar-item" key={wk}>
                <div className="winrate-bar-pct" style={{ color: col }}>{pct}%</div>
                <div className="winrate-bar-track">
                  <div className="winrate-bar-fill" style={{ height: `${pct}%`, background: col }} />
                </div>
                <div className="winrate-bar-label">{label}</div>
                <div className="winrate-bar-sub">{w}/{total}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}