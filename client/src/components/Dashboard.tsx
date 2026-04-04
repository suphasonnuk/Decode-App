import { useEffect, useState, useRef, useMemo } from 'react'
import type { Tab, LogRow } from '../types'
import type { Achievement, UserStats } from '../achievements'
import type { UserProfile } from '../store'
import { GENDER_OPTIONS, GOAL_OPTIONS, SLEEP_OPTIONS, EXERCISE_DAYS_OPTIONS, FITNESS_GOAL_OPTIONS } from '../data'
import { DAYS_MINI, getGreeting } from '../data'
import { ALL_ACHIEVEMENTS, getUnlockedAchievements, getNewAchievements } from '../achievements'
import { api } from '../api'
import { alpha } from '../lib/color'
import { getTodayCache, getNightCache, getAnchors, weekDates, parseBQDate, getUserId, getProfileCache, saveProfileCache, todayStr, calculateNutritionTargets, getStreakFreezeCount } from '../store'
import MorningFeed from './MorningFeed'

interface ChallengeData {
  category: string
  icon: string
  observation: string
  challenge: string
  science: string
  source: string
  difficulty: string
}

interface WeeklyStoryData {
  headline: string
  story: string
  score: number | null
  pattern: string | null
  next_week: string | null
  days_logged?: number
  win_rate?: number
  stats?: Record<string, string>
}

interface Props {
  onTabChange: (t: string) => void
  onNewAchievement: (a: Achievement) => void
}

function getLossMessage(streak: number, nightDone: boolean, hour: number) {
  if (nightDone || streak < 3) return null
  if (hour >= 22) return { emoji: '🚨', title: `${streak}-day streak ends at midnight`, sub: 'Close the day NOW before you lose it.', color: 'var(--miss)', urgent: true }
  if (hour >= 18) return { emoji: '🔥', title: `Your ${streak}-day streak is at risk`, sub: 'Close the day tonight to keep it alive.', color: 'var(--miss)', urgent: true }
  if (hour >= 14) return { emoji: '⚡', title: `${streak}-day streak — close the day tonight`, sub: 'You\'re on a roll. Keep it going.', color: 'var(--partial)', urgent: false }
  return null
}

function getStreakRisk(hour: number, nightDone: boolean): number {
  if (nightDone) return 0
  if (hour >= 22) return 95
  if (hour >= 20) return 75
  if (hour >= 18) return 50
  return 0
}

// ── Export / Backup component ──────────────────────────────────────────────────
function ExportBackup() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const downloadData = async (format: 'csv' | 'json') => {
    setLoading(true)
    setStatus(null)
    try {
      const history = await api.getHistory()
      if (!history || history.length === 0) {
        setStatus('No data to export yet')
        return
      }
      let content: string, mime: string, ext: string

      if (format === 'json') {
        content = JSON.stringify(history, null, 2)
        mime = 'application/json'
        ext = 'json'
      } else {
        const keys = Object.keys(history[0]) as string[]
        const csvRows = [keys.join(',')]
        for (const row of history) {
          csvRows.push(keys.map(k => {
            const val = (row as any)[k]
            if (val == null) return ''
            const str = String(val)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"` : str
          }).join(','))
        }
        content = csvRows.join('\n')
        mime = 'text/csv'
        ext = 'csv'
      }

      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `decode-export-${new Date().toISOString().slice(0,10)}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setStatus(`Downloaded ${history.length} entries as ${ext.toUpperCase()}`)
    } catch (err) {
      setStatus('Export failed — ' + (err instanceof Error ? err.message : 'unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="export-btns">
        <button className="export-btn" onClick={() => downloadData('csv')} disabled={loading}>
          <span className="export-btn-icon">📊</span>
          <span className="export-btn-label">CSV</span>
          <span className="export-btn-sub">Spreadsheet format</span>
        </button>
        <button className="export-btn" onClick={() => downloadData('json')} disabled={loading}>
          <span className="export-btn-icon">🔧</span>
          <span className="export-btn-label">JSON</span>
          <span className="export-btn-sub">Developer format</span>
        </button>
      </div>
      {status && <div className="export-status">{status}</div>}
    </>
  )
}

// ── View types ────────────────────────────────────────────────────────────────
type DashView = 'home' | 'profile'

export default function Dashboard({ onTabChange, onNewAchievement }: Props) {
  const [view, setView] = useState<DashView>(() => {
    try {
      if (sessionStorage.getItem('decode_open_profile') === '1') {
        sessionStorage.removeItem('decode_open_profile')
        return 'profile'
      }
    } catch {}
    return 'home'
  })
  // Track if we came from nutrition so we can highlight + scroll to body metrics
  const [highlightBody, setHighlightBody] = useState(() => {
    try { return sessionStorage.getItem('decode_highlight_body') === '1' } catch { return false }
  })
  const bodyMetricsRef = useRef<HTMLDivElement>(null)
  const [weekData,  setWeekData]  = useState<LogRow[]>([])
  const [streak,    setStreak]    = useState<{ current: number; longest30: number; login_streak: number } | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mealLogged,    setMealLogged]    = useState(false)
  const [challenge,     setChallenge]     = useState<ChallengeData | null>(null)
  const [challengeDone,     setChallengeDone]     = useState(false)
  const [challengeExpanded, setChallengeExpanded] = useState(false)
  const [weeklyStory,   setWeeklyStory]   = useState<WeeklyStoryData | null>(null)
  const [storyExpanded, setStoryExpanded] = useState(true)

  // Profile state
  const [profile,    setProfile]   = useState<UserProfile>(getProfileCache)
  const [profDraft,  setProfDraft] = useState<UserProfile>(getProfileCache)
  const [profSaving, setProfSaving]= useState(false)
  const [profSaved,  setProfSaved] = useState(false)
  const [profError,  setProfError] = useState('')

  const day   = getTodayCache()
  const night = getNightCache()
  const anch  = getAnchors()
  const now   = new Date()
  const hour  = now.getHours()

  const tasksSelected = !!(day.work_task && day.future_task && day.body_task)
  const nightDone     = !!(night.outcome && night.tomorrow_action)
  const anchorsSet    = !!(anch.work || anch.future || anch.body)

  const userId = getUserId()
  const onNewAchRef = useRef(onNewAchievement)
  onNewAchRef.current = onNewAchievement

  useEffect(() => {
    // FIX Bug 3: load trends (30d) for accurate lifetime totalWins
    Promise.all([api.getWeek(), api.getStreak(), api.getProfile(userId), api.getTrends(), api.getNutritionToday(userId)])
      .then(([rows, s, bqProfile, trends, nutrition]) => {
        // Check if at least one meal was logged today
        const nutritionData = nutrition as { entries?: unknown[] } | null
        setMealLogged((nutritionData?.entries?.length ?? 0) > 0)
        setWeekData(rows as LogRow[])
        setStreak(s)

        if (bqProfile) {
          const merged = { ...getProfileCache(), ...bqProfile } as UserProfile
          setProfile(merged)
          setProfDraft(merged)
          saveProfileCache(merged)
        }

        const trendRows = trends as Array<{ day_outcome?: string; energy_level?: number }>
        const lifetimeWins = trendRows.filter(t => t.day_outcome === 'win').length
        const weekRows = rows as LogRow[]
        const energies     = weekRows.map(r => r.energy_level).filter((v): v is number => typeof v === 'number' && v > 0)
        const avgEnergy    = energies.length ? energies.reduce((a,b)=>a+b,0)/energies.length : 0
        const daysLogged   = trendRows.filter(t => t.day_outcome).length
        const winRate      = daysLogged > 0 ? Math.round((lifetimeWins/daysLogged)*100) : 0

        const stats: UserStats = {
          currentStreak: s.current,
          winRatePct:    winRate,
          avgEnergy,
          totalWins:     lifetimeWins,
          longestStreak: s.longest30,
        }
        const newAch = getNewAchievements(stats)
        newAch.forEach(a => onNewAchRef.current(a))
      })
      .catch(err => {
        console.warn('[Dashboard] Load failed:', err)
        setLoadError('Could not load data — pull down to retry')
      })
      .finally(() => setLoading(false))

    // Morning challenge — cached in sessionStorage, one call per day
    const todayKey   = 'decode_challenge_' + todayStr()
    const weekKey    = 'decode_story_week_' + todayStr().slice(0, 7) + '_' + new Date(todayStr() + 'T12:00:00').getDay()
    const cachedCh   = sessionStorage.getItem(todayKey)
    const cachedSt   = sessionStorage.getItem(weekKey)
    const localToday = todayStr()
    
    // Challenge — try cache first, fall back to API, clear corrupted cache
    let challengeLoaded = false
    if (cachedCh) {
      try { setChallenge(JSON.parse(cachedCh)); challengeLoaded = true } catch { sessionStorage.removeItem(todayKey) }
    }
    if (!challengeLoaded) {
      api.getChallenge()
        .then(data => { setChallenge(data); sessionStorage.setItem(todayKey, JSON.stringify(data)) })
        .catch(err => console.warn('[Dashboard] Challenge fetch failed:', err))
    }

    // Weekly story — only fetch on Sundays (or if cached from today's Sunday)
    const isSundayToday = new Date(todayStr() + 'T12:00:00').getDay() === 0
    if (isSundayToday) {
      let storyLoaded = false
      if (cachedSt) {
        try { setWeeklyStory(JSON.parse(cachedSt)); storyLoaded = true } catch { sessionStorage.removeItem(weekKey) }
      }
      if (!storyLoaded) {
        api.getWeeklyStory()
          .then(data => { setWeeklyStory(data); sessionStorage.setItem(weekKey, JSON.stringify(data)) })
          .catch(err => console.warn('[Dashboard] Weekly story fetch failed:', err))
      }
    }

    // Restore challenge done/seen state — synced with ChallengePopup keys
    const challengeSeen = sessionStorage.getItem('decode_challenge_done_' + localToday) === '1' ||
        sessionStorage.getItem('decode_challenge_seen_' + localToday) === '1'
    if (challengeSeen) setChallengeDone(true)
  }, [])

  // Save profile to BQ + local cache
  // Auto-scroll to body metrics when navigated from nutrition nudge
  useEffect(() => {
    if (view === 'profile' && highlightBody && bodyMetricsRef.current) {
      setTimeout(() => {
        bodyMetricsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightBody(false)
          try { sessionStorage.removeItem('decode_highlight_body') } catch {}
        }, 3000)
      }, 150)
    }
  }, [view, highlightBody])

  const handleProfileSave = async () => {
    if (!profDraft.name.trim() && !profDraft.email.trim()) {
      setProfError('Add at least a name or email')
      return
    }
    // Validate profile image before sending — must match server-side regex
    if (profDraft.profile_image) {
      if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]/.test(profDraft.profile_image)) {
        setProfError('Profile image format not supported — try a JPEG or PNG')
        return
      }
      if (profDraft.profile_image.length > 200000) {
        setProfError('Profile image too large — try a smaller photo')
        return
      }
    }
    setProfError('')
    setProfSaving(true)
    try {
      const payload: UserProfile = { ...profDraft, user_id: userId }
      const res = await api.saveProfile(payload)
      if (res.success) {
        setProfile(payload)
        saveProfileCache(payload)
        setProfSaved(true)
        setTimeout(() => setProfSaved(false), 3000)
      } else {
        setProfError(res.error ?? 'Save failed')
      }
    } catch (err) {
      setProfError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setProfSaving(false)
    }
  }

  // Computed stats — memoized so profile-form keystrokes don't re-run these
  const { wins, winRateWeek, avgEnergy, avgFocus, avgMood } = useMemo(() => {
    const daysWithOutcome = weekData.filter(r => r.day_outcome)
    const wins            = daysWithOutcome.filter(r => r.day_outcome === 'win').length
    const winRateWeek     = daysWithOutcome.length > 0 ? Math.round((wins / daysWithOutcome.length) * 100) : null
    const avgOf = (key: keyof LogRow) => {
      const vals = weekData.map(r => r[key]).filter((v): v is number => typeof v === 'number' && v > 0)
      return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null
    }
    return {
      wins,
      winRateWeek,
      avgEnergy: avgOf('energy_level'),
      avgFocus:  avgOf('focus_level'),
      avgMood:   avgOf('mood_level'),
    }
  }, [weekData])

  const lossMsg    = getLossMessage(streak?.current ?? 0, nightDone, hour)
  const streakRisk = getStreakRisk(hour, nightDone)

  // Computed day completion signals
  const energyLogged   = !!(day.energy_level && day.energy_level > 0)
  const morningLogged  = !!(tasksSelected && energyLogged)
  const tasksCompleted = [day.work_done, day.future_done, day.body_done].filter(Boolean).length >= 2

  const todaySteps = [
    {
      label: 'Anchors set',     done: anchorsSet,    icon: '🧭',
      tab: 'anchors' as Tab,    sub: anchorsSet ? 'Set ✓' : 'Set anchors',
    },
    {
      label: 'Morning logged',  done: morningLogged, icon: '☀️',
      tab: 'daily' as Tab,      sub: morningLogged ? `Energy ${day.energy_level}/10` : 'Log morning',
    },
    {
      label: 'Tasks done',      done: tasksCompleted, icon: '✅',
      tab: 'daily' as Tab,      sub: `${[day.work_done, day.future_done, day.body_done].filter(Boolean).length}/3 done`,
    },
    {
      label: 'Meal logged',     done: mealLogged,    icon: '🥗',
      tab: 'nutrition' as Tab,  sub: mealLogged ? 'Logged ✓' : 'Log meal',
    },
    {
      label: 'Day closed',      done: nightDone,     icon: '🌙',
      tab: 'night' as Tab,      sub: nightDone ? 'Closed ✓' : 'Close day',
    },
  ]
  const todayPct = Math.round((todaySteps.filter(s=>s.done).length / todaySteps.length) * 100)

  // weekDates is stable within a day (component remounts at midnight)
  const dates         = useMemo(() => weekDates(), [])
  const todayLocalStr = todayStr()

  const { unlockedAch, lockedAch } = useMemo(() => {
    const stats: UserStats = {
      currentStreak: streak?.current ?? 0,
      winRatePct:    winRateWeek ?? 0,
      avgEnergy:     avgEnergy ?? 0,
      totalWins:     wins,
      longestStreak: streak?.longest30 ?? 0,
    }
    const unlockedAch = getUnlockedAchievements(stats)
    const lockedAch   = ALL_ACHIEVEMENTS.filter(a => !unlockedAch.find(u => u.id === a.id)).slice(0, 4)
    return { unlockedAch, lockedAch }
  }, [streak, winRateWeek, avgEnergy, wins])

  const greeting = getGreeting(hour)

  // userAge removed from profile card — kept in profile editor only

  // ── Render: Profile editor ──────────────────────────────────────────────────
  // Memoized: only recomputes when nutrition-relevant fields change, not on every keystroke
  const t = useMemo(() => {
    if (!profDraft.height_cm || !profDraft.weight_kg || !profDraft.birth_year) return null
    return calculateNutritionTargets(profDraft)
  }, [profDraft.height_cm, profDraft.weight_kg, profDraft.birth_year, profDraft.exercise_days_per_week, profDraft.fitness_goal, profDraft.gender])
  const tdeePreview = t ? (
    <div className="prof-tdee-card">
      <div className="prof-tdee-title">📊 Your personalized daily targets</div>
      <div className="prof-tdee-formula">
        Mifflin-St Jeor · BMR {t.bmr} kcal → TDEE {t.tdee} kcal
        {profDraft.fitness_goal === 'lose_weight' ? ' − 400' : profDraft.fitness_goal === 'gain_muscle' ? ' + 300' : ''}
      </div>
      <div className="prof-tdee-macros">
        <div className="prof-tdee-macro"><span style={{color:'var(--accent)'}}>{t.calories}</span><small>kcal</small></div>
        <div className="prof-tdee-macro"><span style={{color:'var(--work)'}}>{t.protein_g}g</span><small>protein</small></div>
        <div className="prof-tdee-macro"><span style={{color:'var(--future)'}}>{t.carbs_g}g</span><small>carbs</small></div>
        <div className="prof-tdee-macro"><span style={{color:'var(--partial)'}}>{t.fat_g}g</span><small>fat</small></div>
        <div className="prof-tdee-macro"><span style={{color:'var(--body)'}}>{t.fiber_g}g</span><small>fiber</small></div>
      </div>
    </div>
  ) : (
    <div className="prof-tdee-empty">
      Fill in height, weight, and birth year above to see your personalized calorie and macro targets.
    </div>
  )

  if (view === 'profile') return (
    <div className="dash">
      <div className="prof-header">
        <button className="prof-back" onClick={() => setView('home')}>← Back</button>
        <div className="prof-header-title">Edit Profile</div>
      </div>

      {/* Avatar + identity */}
      <div className="prof-avatar-row">
        <div className="prof-avatar-upload-wrap">
          {profDraft.profile_image ? (
            <img src={profDraft.profile_image} alt="Profile" className="prof-avatar-img" />
          ) : (
            <div className="dash-avatar dash-avatar-lg">
              {profDraft.name ? profDraft.name.slice(0,1).toUpperCase() : 'D'}
            </div>
          )}
          <label className="prof-avatar-upload-btn" title="Upload photo">
            📷
            <input
              type="file"
              accept="image/*"
              className="prof-avatar-file-input"
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 5 * 1024 * 1024) { setProfError('Image must be under 5 MB'); return }
                const reader = new FileReader()
                reader.onerror = () => setProfError('Failed to read image file')
                reader.onload = () => {
                  const img = new Image()
                  img.onerror = () => setProfError('Selected file is not a valid image')
                  img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const size = 128
                    canvas.width = size
                    canvas.height = size
                    const ctx = canvas.getContext('2d')
                    if (!ctx) { setProfError('Could not process image'); return }
                    const minDim = Math.min(img.width, img.height)
                    const sx = (img.width - minDim) / 2
                    const sy = (img.height - minDim) / 2
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
                    setProfDraft(p => ({ ...p, profile_image: dataUrl }))
                    setProfError('')
                  }
                  img.src = reader.result as string
                }
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
          </label>
          {profDraft.profile_image && (
            <button
              className="prof-avatar-remove-btn"
              onClick={() => setProfDraft(p => ({ ...p, profile_image: null }))}
              title="Remove photo"
            >✕</button>
          )}
        </div>
        <div>
          <div className="prof-user-id-label">User ID</div>
          <div className="prof-user-id-value">{userId}</div>
          <div className="prof-user-id-hint">Stored in BigQuery — links your logs to your profile</div>
        </div>
      </div>

      {/* Fields */}
      <div className="prof-section">
        <div className="prof-section-title">Identity</div>

        <div className="prof-field">
          <label className="prof-label">Full name</label>
          <input className="prof-input" value={profDraft.name}
            onChange={e => setProfDraft(p=>({...p,name:e.target.value}))}
            placeholder="Your name..." />
        </div>

        <div className="prof-field">
          <label className="prof-label">Email address</label>
          <input className="prof-input" type="email" value={profDraft.email}
            onChange={e => setProfDraft(p=>({...p,email:e.target.value}))}
            placeholder="your@email.com" />
          <div className="prof-hint">Stored in your private BigQuery. Not shared with anyone.</div>
        </div>
      </div>

      <div className="prof-section">
        <div className="prof-section-title">Demographics</div>

        <div className="prof-field">
          <label className="prof-label">Birth year</label>
          <input className="prof-input" type="number" min={1950} max={2010}
            value={profDraft.birth_year ?? ''}
            onChange={e => setProfDraft(p=>({...p,birth_year:e.target.value?parseInt(e.target.value):null}))}
            placeholder="e.g. 1995" />
          <div className="prof-hint">Used to correlate age with energy/mood trends in BigQuery</div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Gender</label>
          <select className="prof-select" value={profDraft.gender}
            onChange={e => setProfDraft(p=>({...p,gender:e.target.value}))}>
            <option value="">— Select —</option>
            {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>

      <div className="prof-section">
        <div className="prof-section-title">Context</div>

        <div className="prof-field">
          <label className="prof-label">Occupation / role</label>
          <input className="prof-input" value={profDraft.occupation}
            onChange={e => setProfDraft(p=>({...p,occupation:e.target.value}))}
            placeholder="e.g. Data Engineer, Consultant..." />
          <div className="prof-hint">Helps segment your data by role in BigQuery analysis</div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Primary goal for using DECODE</label>
          <div className="prof-goal-grid">
            {GOAL_OPTIONS.map(g => (
              <button
                key={g.value}
                className={`prof-goal-btn ${profDraft.primary_goal === g.value ? 'active' : ''}`}
                onClick={() => setProfDraft(p=>({...p,primary_goal:g.value}))}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Sleep target (hours per night)</label>
          <div className="prof-sleep-row">
            {SLEEP_OPTIONS.map(h => (
              <button
                key={h}
                className={`prof-sleep-btn ${profDraft.sleep_target_hrs === h ? 'active' : ''}`}
                onClick={() => setProfDraft(p=>({...p,sleep_target_hrs:h}))}
              >
                {h}h
              </button>
            ))}
          </div>
          <div className="prof-hint">Compare your sleep goal vs your actual mood/energy in Trends</div>
        </div>

        {/* ── Body metrics for TDEE calculation ── */}
        <div
          ref={bodyMetricsRef}
          className={`prof-section-body-metrics${highlightBody ? ' prof-section-highlight' : ''}`}
        >
          <div className="prof-section-title prof-section-title-with-hint">
            📊 Nutrition targets
            <span className="prof-nutrition-label-hint">
              Used to calculate your personal TDEE
            </span>
          </div>
        </div>
        <div className="prof-field">
          <label className="prof-label">Height</label>
          <div className="prof-input-row">
            <input
              className="prof-input" type="number" min="100" max="250" step="1"
              value={profDraft.height_cm ?? ''}
              onChange={e => setProfDraft(p=>({...p, height_cm: e.target.value ? Number(e.target.value) : null}))}
              placeholder="e.g. 175"
            />
            <span className="prof-unit">cm</span>
          </div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Weight</label>
          <div className="prof-input-row">
            <input
              className="prof-input" type="number" min="30" max="300" step="0.5"
              value={profDraft.weight_kg ?? ''}
              onChange={e => setProfDraft(p=>({...p, weight_kg: e.target.value ? Number(e.target.value) : null}))}
              placeholder="e.g. 70"
            />
            <span className="prof-unit">kg</span>
          </div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Exercise frequency</label>
          <select
            className="prof-select"
            value={profDraft.exercise_days_per_week ?? ''}
            onChange={e => setProfDraft(p=>({...p, exercise_days_per_week: e.target.value !== '' ? Number(e.target.value) : null}))}
          >
            <option value="">— Select —</option>
            {EXERCISE_DAYS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="prof-field">
          <label className="prof-label">Fitness goal</label>
          <div className="prof-goal-grid">
            {FITNESS_GOAL_OPTIONS.map(g => (
              <button
                key={g.value}
                className={`prof-goal-btn ${profDraft.fitness_goal === g.value ? 'active' : ''}`}
                onClick={() => setProfDraft(p=>({...p, fitness_goal: g.value}))}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="prof-field">
          <label className="prof-label">Timezone</label>
          <input className="prof-input input-readonly" value={profDraft.timezone} readOnly />
          <div className="prof-hint">Detected automatically from your device</div>
        </div>
      </div>

      {profError && <div className="prof-error" role="alert">{profError}</div>}

      {/* TDEE preview — pre-computed above as tdeePreview */}
      {tdeePreview}

      <button
        className={`${profSaved ? 'btn-success' : 'btn-primary'} btn-full mb-3`}
        onClick={handleProfileSave}
        disabled={profSaving}
      >
        {profSaving && <span className="spinner show" />}
        {profSaved ? '✓ Profile Saved to BigQuery' : 'Confirm & Save Profile'}
      </button>

      {/* ── Export / Backup ── */}
      <div className="prof-section export-section">
        <div className="prof-section-title">Export Your Data</div>
        <ExportBackup />
      </div>

      <button className="btn-secondary btn-full" onClick={() => { setProfDraft(profile); setView('home') }}>
        Cancel
      </button>
    </div>
  )

  // ── Render: Home dashboard ──────────────────────────────────────────────────
  return (
    <div className="dash">

      {/* Profile header */}
      <div className="dash-profile" onClick={() => setView('profile')}>
        {profile.profile_image ? (
          <img src={profile.profile_image} alt="" className="dash-avatar-img" />
        ) : (
          <div className="dash-avatar">
            {profile.name ? profile.name.slice(0,1).toUpperCase() : 'D'}
          </div>
        )}
        <div className="dash-profile-right">
          <div className="dash-greeting">
            <span className="dash-greeting-text">
              {profile.name ? profile.name : greeting}
            </span>
            {!profile.name && (
              <span className="dash-name-hint" style={{ color: 'var(--accent)' }}>Tap to set name →</span>
            )}
          </div>
          <div className="dash-date">
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div className="dash-chevron">›</div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="warning-banner" style={{ cursor: 'pointer' }} onClick={() => window.location.reload()}>
          <span>⚠️</span>
          <span>{loadError}</span>
        </div>
      )}

      {/* Today progress — primary focal point */}
      <div className="dash-card" onClick={() => onTabChange(todaySteps.find(s=>!s.done)?.tab ?? 'daily')}>
        <div className="dash-progress-hero">
          <svg className="progress-ring" viewBox="0 0 100 100">
            <circle className="progress-ring-bg" cx="50" cy="50" r="42" />
            <circle
              className="progress-ring-fill"
              cx="50" cy="50" r="42"
              style={{
                strokeDasharray: `${2 * Math.PI * 42}`,
                strokeDashoffset: `${2 * Math.PI * 42 * (1 - todayPct / 100)}`,
                stroke: todayPct===100?'var(--win)':todayPct>=66?'var(--future)':'var(--work)',
              }}
            />
          </svg>
          <div className="progress-ring-label">
            <span className="progress-ring-pct" style={{ color: todayPct===100?'var(--win)':'var(--accent)' }}>{todayPct}%</span>
            <span className="progress-ring-sub">today</span>
          </div>
        </div>
        <div className="dash-today-steps">
          {todaySteps.map(s => (
            <div
              key={s.label}
              className={`dash-today-step ${s.done?'done':''}`}
              onClick={e => { e.stopPropagation(); onTabChange(s.tab) }}
            >
              <div className={`dash-today-check ${s.done?'done':''}`}>{s.done?'✓':''}</div>
              <div className="dash-today-step-body">
                <div className="dash-today-step-row">
                  <span className="dash-today-step-icon">{s.icon}</span>
                  <span className="dash-today-step-label">{s.label}</span>
                </div>
                <div className="dash-today-step-sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
        {todayPct < 100 && (
          <div className="dash-card-cta">
            Next → {todaySteps.find(s=>!s.done)?.label}
          </div>
        )}
      </div>

      {/* Loss aversion banner — only when streak is at risk */}
      {lossMsg && (
        <div
          className={`dash-loss-banner ${lossMsg.urgent ? 'dash-loss-urgent' : ''}`}
          style={{ borderColor: lossMsg.urgent ? alpha('var(--miss)', 40) : alpha('var(--partial)', 30) }}
          onClick={() => onTabChange('night')}
        >
          <div className="dash-loss-left">
            <span className="dash-loss-emoji">{lossMsg.emoji}</span>
            <div>
              <div className="dash-loss-title" style={{ color: lossMsg.color }}>{lossMsg.title}</div>
              <div className="dash-loss-sub">{lossMsg.sub}</div>
            </div>
          </div>
          <div className="dash-loss-arrow" style={{ color: lossMsg.color }}>→</div>
        </div>
      )}

      {/* Streak row */}
      <div className="dash-streak-row">

        {/* WIN streak */}
        <div className="dash-streak-card dash-streak-card-flex" onClick={() => onTabChange('week')}>
          <div className="dash-streak-fire">{(streak?.current ?? 0) > 0 ? '🔥' : '💤'}</div>
          <div>
            <div className="dash-streak-num">{loading ? '—' : streak?.current ?? 0}</div>
            <div className="dash-streak-label">win streak</div>
          </div>
          {streakRisk > 0 && (
            <div className="dash-streak-risk">
              <div className="dash-streak-risk-bar">
                <div className="dash-streak-risk-fill" style={{ width: `${streakRisk}%` }} />
              </div>
              <div className="dash-streak-risk-label">{streakRisk}% risk tonight</div>
            </div>
          )}
        </div>

        {/* Login streak — any log counts */}
        <div className="dash-streak-card dash-streak-card-flex" onClick={() => onTabChange('week')}>
          <div className="dash-streak-fire">{(streak?.login_streak ?? 0) > 0 ? '📅' : '💤'}</div>
          <div>
            <div className="dash-streak-num">{loading ? '—' : streak?.login_streak ?? 0}</div>
            <div className="dash-streak-label">log streak</div>
          </div>
        </div>

        {/* Best WIN streak */}
        <div className="dash-streak-card dash-streak-card-flex" onClick={() => onTabChange('week')}>
          <div className="dash-streak-fire">🏅</div>
          <div>
            <div className="dash-streak-num">{loading ? '—' : streak?.longest30 ?? 0}</div>
            <div className="dash-streak-label">best in 30d</div>
          </div>
        </div>

      </div>

      {/* Streak freeze indicator */}
      {(streak?.current ?? 0) >= 3 && (
        <div className="streak-freeze-hint">
          <span className="streak-freeze-icon">🧊</span>
          <span className="streak-freeze-text">
            {getStreakFreezeCount() > 0
              ? 'Streak freeze available — protects you if you miss a day'
              : 'Streak freeze used this week'}
          </span>
        </div>
      )}

      {/* ── Weekly Story — Sundays only ── */}
      {weeklyStory && weeklyStory.score != null && (
        <div className="dash-story-card" style={{
          borderColor: weeklyStory.score >= 7 ? alpha('var(--win)', 20) : weeklyStory.score >= 5 ? alpha('var(--partial)', 20) : alpha('var(--miss)', 20)
        }}>
          <div className="dash-story-header" onClick={() => setStoryExpanded(p => !p)}>
            <div className="dash-story-header-left">
              <span className="dash-story-emoji">
                {weeklyStory.score >= 7 ? '🔥' : weeklyStory.score >= 5 ? '⚡' : '🔄'}
              </span>
              <div>
                <div className="dash-story-eyebrow">Weekly Story</div>
                <div className="dash-story-headline">{weeklyStory.headline}</div>
              </div>
            </div>
            <div className="dash-story-score" style={{
              color: weeklyStory.score >= 7 ? 'var(--win)' : weeklyStory.score >= 5 ? 'var(--partial)' : 'var(--miss)'
            }}>
              <span className="dash-story-score-num">{weeklyStory.score}</span>
              <span className="dash-story-score-denom">/10</span>
            </div>
          </div>

          {storyExpanded && (
            <div className="dash-story-body">
              {weeklyStory.stats && (
                <div className="dash-story-stats">
                  {[
                    { label: 'Win rate',   val: weeklyStory.stats.win_rate,   color: 'var(--win)'     },
                    { label: 'Energy',     val: weeklyStory.stats.avg_energy, color: 'var(--work)'    },
                    { label: 'Focus',      val: weeklyStory.stats.avg_focus,  color: 'var(--future)'  },
                    { label: 'Mood',       val: weeklyStory.stats.avg_mood,   color: 'var(--body)'    },
                  ].map(s => (
                    <div key={s.label} className="dash-story-stat">
                      <div className="dash-story-stat-val" style={{ color: s.color }}>{s.val}</div>
                      <div className="dash-story-stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="dash-story-text">{weeklyStory.story}</p>
              {weeklyStory.pattern && (
                <div className="dash-story-pattern">
                  <span>🔍</span>
                  <span><strong>Pattern: </strong>{weeklyStory.pattern}</span>
                </div>
              )}
              {weeklyStory.next_week && (
                <div className="dash-story-next">
                  <span>🎯</span>
                  <span><strong>Next week: </strong>{weeklyStory.next_week}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Morning Challenge — compact by default */}
      {challenge && !challengeDone && (
        <div className="dash-challenge-card" onClick={() => setChallengeExpanded(p => !p)}>
          <div className="dash-challenge-header">
            <div className="dash-challenge-icon-wrap">
              <span className="dash-challenge-icon">{challenge.icon || '🎯'}</span>
            </div>
            <div className="dash-challenge-head dash-challenge-head-flex">
              <div className="dash-challenge-eyebrow">{challenge.category}</div>
              <div className="dash-challenge-observation" style={{
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: challengeExpanded ? 99 : 1,
                WebkitBoxOrient: 'vertical' as any,
              }}>
                {challenge.observation}
              </div>
            </div>
            <span className="dash-expand-icon">
              {challengeExpanded ? '▲' : '▼'}
            </span>
          </div>
          {challengeExpanded && (
            <div onClick={e => e.stopPropagation()}>
              <div className="dash-challenge-body">
                <p className="dash-challenge-text">{challenge.challenge}</p>
              </div>
              <div className="dash-challenge-science">
                <span>📊</span>
                <span>{challenge.science}</span>
              </div>
              <div className="dash-challenge-footer">
                <span className="dash-challenge-source">{challenge.source}</span>
                <button className="dash-challenge-done-btn" onClick={e => {
                  e.stopPropagation()
                  setChallengeDone(true)
                  try {
                    sessionStorage.setItem('decode_challenge_done_' + todayStr(), '1')
                    sessionStorage.setItem('decode_challenge_seen_' + todayStr(), '1')
                  } catch {}
                }}>
                  ✓ Got it
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {challenge && challengeDone && (
        <div className="dash-challenge-done">
          <span>{challenge.icon || '🎯'}</span>
          <span>Challenge accepted — {challenge.category}</span>
          <button className="challenge-show-btn" onClick={() => setChallengeDone(false)}>
            show again
          </button>
        </div>
      )}

      {/* DECODE Briefing — inspirational content after action items */}
      <MorningFeed />

      {/* This week — mini calendar + stats in one card */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-card-title">This week</span>
          <button className="dash-card-link" onClick={() => onTabChange('week')}>Full view →</button>
        </div>
        <div className="dash-mini-week">
          {dates.map(date => {
            const row = weekData.find(r => parseBQDate(r.log_date) === date)
            const out = row?.day_outcome
            const isFuture = date > todayLocalStr
            const isToday  = date === todayLocalStr
            const dayName  = DAYS_MINI[new Date(date+'T12:00:00').getDay()]
            return (
              <div key={date} className={`dash-mini-day ${isToday?'today':''} ${isFuture?'future':''}`}>
                <div className="dash-mini-name">{dayName}</div>
                <div className="dash-mini-dot" style={{
                  background: out==='win'?'var(--win)':out==='partial'?'var(--partial)':out==='miss'?'var(--miss)':isToday?'oklch(58% 0.12 185 / 0.3)':isFuture?'var(--border)':'var(--border2)',
                  boxShadow: out==='win'?'0 0 6px var(--win)':undefined,
                }} />
                <div className="dash-mini-out" style={{ color: out==='win'?'var(--win)':out==='partial'?'var(--partial)':out==='miss'?'var(--miss)':'transparent' }}>
                  {out==='win'?'✓':out==='partial'?'~':out==='miss'?'✗':''}
                </div>
              </div>
            )
          })}
        </div>
        <div className="dash-stats-row dash-stats-row-incard">
          {[
            { icon:'🏆', label:'Win rate', val: winRateWeek!=null?`${winRateWeek}%`:'—', color: winRateWeek!=null?(winRateWeek>=70?'var(--win)':winRateWeek>=40?'var(--future)':'var(--miss)'):'var(--muted2)' },
            { icon:'⚡', label:'Energy',   val: avgEnergy!=null?`${avgEnergy}`:'—', color:'var(--work)'   },
            { icon:'🎯', label:'Focus',    val: avgFocus !=null?`${avgFocus}` :'—', color:'var(--future)' },
            { icon:'😊', label:'Mood',     val: avgMood  !=null?`${avgMood}`  :'—', color:'var(--body)'   },
          ].map(s => (
            <div key={s.label} className="dash-stat-box" onClick={e => { e.stopPropagation(); onTabChange('trends') }}>
              <div className="dash-stat-icon">{s.icon}</div>
              <div className="dash-stat-val" style={{ color: s.color }}>{loading?'—':s.val}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="dash-card-title">Achievements</span>
          <span className="dash-ach-count">{unlockedAch.length}/{ALL_ACHIEVEMENTS.length}</span>
        </div>
        {unlockedAch.length === 0
          ? <div className="dash-ach-empty">Keep logging daily to unlock your first achievement.</div>
          : (
            <div className="dash-ach-grid">
              {unlockedAch.map(a => (
                <div key={a.id} className="dash-ach-badge unlocked" style={{ borderColor:alpha(a.color, 25), background:alpha(a.color, 6) }}>
                  <span className="dash-ach-emoji">{a.emoji}</span>
                  <span className="dash-ach-title" style={{ color:a.color }}>{a.title}</span>
                </div>
              ))}
              {lockedAch.map(a => (
                <div key={a.id} className="dash-ach-badge locked">
                  <span className="dash-ach-emoji" style={{ filter:'grayscale(1)', opacity:0.3 }}>{a.emoji}</span>
                  <span className="dash-ach-title" style={{ color:'var(--muted)' }}>???</span>
                </div>
              ))}
            </div>
          )
        }
      </div>

    </div>
  )
}