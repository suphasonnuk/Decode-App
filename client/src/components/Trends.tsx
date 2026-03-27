import { useEffect, useState } from 'react'
import type { TrendPoint } from '../types'
import { parseBQDate } from '../store'
import { api } from '../api'

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
  if (!v) return 'var(--muted2)'
  if (v >= 8) return 'var(--win)'
  if (v >= 6) return 'var(--future)'
  if (v >= 4) return 'var(--partial)'
  return 'var(--miss)'
}

function scoreLabel(v: number | null): string {
  if (!v) return '—'
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

  const energy  = points.map(p => p.energy_level)
  const focus   = points.map(p => p.focus_level)
  const mood    = points.map(p => p.mood_level)

  const avgEnergy = avg(energy)
  const avgFocus  = avg(focus)
  const avgMood   = avg(mood)

  const daysLogged = points.filter(p => p.day_outcome).length
  const winCount   = points.filter(p => p.day_outcome === 'win').length
  const winRate    = daysLogged > 0 ? Math.round((winCount / daysLogged) * 100) : 0

  // Weekly win rates for bar chart
  const weeks: Record<string, { total: number, wins: number, label: string }> = {}
  for (const p of points) {
    const d = new Date(p.log_date + 'T12:00:00')
    d.setDate(d.getDate() - d.getDay())
    const wk = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!weeks[wk]) weeks[wk] = { total: 0, wins: 0, label }
    if (p.day_outcome) { weeks[wk].total++; if (p.day_outcome === 'win') weeks[wk].wins++ }
  }
  const weekBars = Object.entries(weeks).sort(([a],[b]) => a.localeCompare(b)).slice(-8)

  const charts = [
    { label: 'Energy',    icon: '⚡', data: energy, color: 'var(--work)',   val: avgEnergy },
    { label: 'Focus',     icon: '🎯', data: focus,  color: 'var(--future)', val: avgFocus  },
    { label: 'Mood',      icon: '😊', data: mood,   color: 'var(--body)',   val: avgMood   },
  ]

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