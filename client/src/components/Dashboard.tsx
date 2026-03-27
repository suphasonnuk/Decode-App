import { useEffect, useState, useRef } from 'react'
import type { Tab, LogRow } from '../types'
import type { Achievement, UserStats } from '../achievements'
import type { UserProfile } from '../store'
import { GENDER_OPTIONS, GOAL_OPTIONS, SLEEP_OPTIONS, EXERCISE_DAYS_OPTIONS, FITNESS_GOAL_OPTIONS } from '../data'
import { DAYS_MINI, getGreeting } from '../data'
import { ALL_ACHIEVEMENTS, getUnlockedAchievements, getNewAchievements } from '../achievements'
import { api } from '../api'
import { getTodayCache, getNightCache, getAnchors, weekDates, parseBQDate, getUserId, getProfileCache, saveProfileCache, todayStr, calculateNutritionTargets } from '../store'

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
  const [streak,    setStreak]    = useState<{ current: number; longest30: number } | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [mealLogged,    setMealLogged]    = useState(false)
  const [challenge,     setChallenge]     = useState<any>(null)
  const [challengeDone,     setChallengeDone]     = useState(false)
  const [challengeExpanded, setChallengeExpanded] = useState(false)
  const [weeklyStory,   setWeeklyStory]   = useState<any>(null)
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

  useEffect(() => {
    // FIX Bug 3: load trends (30d) for accurate lifetime totalWins
    Promise.all([api.getWeek(), api.getStreak(), api.getProfile(userId), api.getTrends(), api.getNutritionToday(userId)])
      .then(([rows, s, bqProfile, trends, nutrition]) => {
        // Check if at least one meal was logged today
        const nutritionData = nutrition as any
        setMealLogged((nutritionData?.entries?.length ?? 0) > 0)
        setWeekData(rows as any)
        setStreak(s)

        if (bqProfile) {
          const merged = { ...getProfileCache(), ...bqProfile }
          setProfile(merged)
          setProfDraft(merged)
          saveProfileCache(merged)
        }

        const lifetimeWins = (trends as any[]).filter(t => t.day_outcome === 'win').length
        const energies     = (rows as any[]).map(r => r.energy_level).filter(Boolean) as number[]
        const avgEnergy    = energies.length ? energies.reduce((a,b)=>a+b,0)/energies.length : 0
        const daysLogged   = (trends as any[]).filter(t => t.day_outcome).length
        const winRate      = daysLogged > 0 ? Math.round((lifetimeWins/daysLogged)*100) : 0

        const stats: UserStats = {
          currentStreak: s.current,
          winRatePct:    winRate,
          avgEnergy,
          totalWins:     lifetimeWins,
          longestStreak: s.longest30,
        }
        const newAch = getNewAchievements(stats)
        newAch.forEach(a => onNewAchievement(a))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Morning challenge — cached in sessionStorage, one call per day
    const todayKey   = 'decode_challenge_' + todayStr()
    const weekKey    = 'decode_story_week_' + todayStr().slice(0, 7) + '_' + new Date(todayStr() + 'T12:00:00').getDay()
    const cachedCh   = sessionStorage.getItem(todayKey)
    const cachedSt   = sessionStorage.getItem(weekKey)
    const localToday = todayStr()
    
    if (cachedCh) {
      try { setChallenge(JSON.parse(cachedCh)) } catch {}
    } else {
      api.getChallenge()
        .then(data => { setChallenge(data); sessionStorage.setItem(todayKey, JSON.stringify(data)) })
        .catch(() => {})
    }

    // Weekly story — only fetch on Sundays (or if cached from today's Sunday)
    const isSundayToday = new Date(todayStr() + 'T12:00:00').getDay() === 0
    if (isSundayToday) {
      if (cachedSt) {
        try { setWeeklyStory(JSON.parse(cachedSt)) } catch {}
      } else {
        api.getWeeklyStory()
          .then(data => { setWeeklyStory(data); sessionStorage.setItem(weekKey, JSON.stringify(data)) })
          .catch(() => {})
      }
    }

    // Restore challenge done/seen state — synced with ChallengePopup keys
    if (sessionStorage.getItem('decode_challenge_done_' + localToday) === '1' ||
        sessionStorage.getItem('decode_challenge_seen_' + localToday) === '1') {
    }
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

  // Computed stats
  const daysWithOutcome = weekData.filter(r => r.day_outcome)
  const wins            = daysWithOutcome.filter(r => r.day_outcome === 'win').length
  const winRateWeek     = daysWithOutcome.length > 0 ? Math.round((wins/daysWithOutcome.length)*100) : null
  const avgOf = (key: keyof LogRow) => {
    const vals = weekData.map(r => r[key]).filter((v): v is number => typeof v === 'number' && v > 0)
    return vals.length ? Math.round((vals.reduce((a:number,b:number)=>a+b,0)/vals.length)*10)/10 : null
  }
  const avgEnergy = avgOf('energy_level')
  const avgFocus  = avgOf('focus_level')
  const avgMood   = avgOf('mood_level')

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
      tab: 'nutrition' as any,  sub: mealLogged ? 'Logged ✓' : 'Log meal',
    },
    {
      label: 'Day closed',      done: nightDone,     icon: '🌙',
      tab: 'night' as Tab,      sub: nightDone ? 'Closed ✓' : 'Close day',
    },
  ]
  const todayPct = Math.round((todaySteps.filter(s=>s.done).length / todaySteps.length) * 100)

  const dates       = weekDates()
  const todayLocalStr = todayStr()

  const stats: UserStats = {
    currentStreak: streak?.current ?? 0,
    winRatePct: winRateWeek ?? 0,
    avgEnergy: avgEnergy ?? 0,
    totalWins: wins,
    longestStreak: streak?.longest30 ?? 0,
  }
  const unlockedAch = getUnlockedAchievements(stats)
  const lockedAch   = ALL_ACHIEVEMENTS.filter(a => !unlockedAch.find(u=>u.id===a.id)).slice(0,4)

  const greeting = () => getGreeting(hour)

  // userAge removed from profile card — kept in profile editor only

  // ── Render: Profile editor ──────────────────────────────────────────────────
  // Pre-compute TDEE preview (avoids IIFE inside JSX which some bundlers reject)
  const t = (profDraft.height_cm && profDraft.weight_kg && profDraft.birth_year)
    ? calculateNutritionTargets(profDraft)
    : null
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
        <div className="dash-avatar" style={{ width: 64, height: 64, fontSize: 28 }}>
          {profDraft.name ? profDraft.name.slice(0,1).toUpperCase() : '🦞'}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 3 }}>User ID</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{userId}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>Stored in BigQuery — links your logs to your profile</div>
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
          <div className="prof-section-title" style={{ marginBottom: 14 }}>
            📊 Nutrition targets
            <span style={{ fontSize: 9, color: 'var(--muted2)', marginLeft: 8, fontWeight: 400 }}>
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
          <input className="prof-input" value={profDraft.timezone} readOnly
            style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          <div className="prof-hint">Detected automatically from your device</div>
        </div>
      </div>

      {profError && <div className="prof-error">{profError}</div>}

      {/* TDEE preview — pre-computed above as tdeePreview */}
      {tdeePreview}

      <button
        className={profSaved ? 'btn-success' : 'btn-primary'}
        style={{ width: '100%', marginBottom: 12 }}
        onClick={handleProfileSave}
        disabled={profSaving}
      >
        {profSaving && <span className="spinner show" />}
        {profSaved ? '✓ Profile Saved to BigQuery' : 'Confirm & Save Profile'}
      </button>

      <button className="btn-secondary" style={{ width: '100%' }} onClick={() => { setProfDraft(profile); setView('home') }}>
        Cancel
      </button>
    </div>
  )

  // ── Render: Home dashboard ──────────────────────────────────────────────────
  return (
    <div className="dash">

      {/* Profile header */}
      <div className="dash-profile" onClick={() => setView('profile')}>
        <div className="dash-avatar">
          {profile.name ? profile.name.slice(0,1).toUpperCase() : '🦞'}
        </div>
        <div className="dash-profile-right">
          <div className="dash-greeting">
            <span className="dash-greeting-text">
              {profile.name ? profile.name : greeting()}
            </span>
            {!profile.name && (
              <span className="dash-name-hint" style={{ color: 'var(--accent)' }}>Tap to set name →</span>
            )}
          </div>
          <div className="dash-date">
            {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <div style={{ color: 'var(--muted2)', fontSize: 16, flexShrink: 0 }}>›</div>
      </div>

      {/* ── Weekly Story — Sundays only ── */}
      {weeklyStory && weeklyStory.score !== undefined && (
        <div className="dash-story-card" style={{
          borderColor: weeklyStory.score >= 7 ? 'var(--win)30' : weeklyStory.score >= 5 ? 'var(--partial)30' : 'var(--miss)30'
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
              {/* Stats row */}
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

      {/* ── Loss aversion banner */}
      {lossMsg && (
        <div
          className={`dash-loss-banner ${lossMsg.urgent ? 'dash-loss-urgent' : ''}`}
          style={{ borderColor: lossMsg.urgent ? 'rgba(239,83,80,0.4)' : 'rgba(255,183,77,0.3)' }}
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

      {/* Streak row — 3 cards, wraps on very small screens */}
      <div className="dash-streak-row" style={{ flexWrap: 'wrap' }}>

        {/* WIN streak */}
        <div className="dash-streak-card" style={{ minWidth: 100, flex: '1 1 100px' }} onClick={() => onTabChange('week')}>
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
        <div className="dash-streak-card" style={{ flex: '1 1 100px', minWidth: 100 }} onClick={() => onTabChange('week')}>
          <div className="dash-streak-fire">{(streak?.current ?? 0) > 0 ? '📅' : '💤'}</div>
          <div>
            <div className="dash-streak-num">{loading ? '—' : streak?.current ?? 0}</div>
            <div className="dash-streak-label">log streak</div>
          </div>
        </div>

        {/* Best WIN streak */}
        <div className="dash-streak-card" style={{ flex: '1 1 100px', minWidth: 100 }} onClick={() => onTabChange('week')}>
          <div className="dash-streak-fire">🏅</div>
          <div>
            <div className="dash-streak-num">{loading ? '—' : streak?.longest30 ?? 0}</div>
            <div className="dash-streak-label">best in 30d</div>
          </div>
        </div>

      </div>

      {/* ── Morning Challenge — compact by default ── */}
      {challenge && !challengeDone && (
        <div className="dash-challenge-card" onClick={() => setChallengeExpanded(p => !p)}>

          {/* Always visible: icon + category + expand arrow */}
          <div className="dash-challenge-header">
            <div className="dash-challenge-icon-wrap">
              <span className="dash-challenge-icon">{challenge.icon || '🎯'}</span>
            </div>
            <div className="dash-challenge-head" style={{ flex: 1 }}>
              <div className="dash-challenge-eyebrow">{challenge.category}</div>
              <div className="dash-challenge-observation" style={{
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: challengeExpanded ? 99 : 1,
                WebkitBoxOrient: 'vertical' as any,
              }}>
                {challenge.observation}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted2)', flexShrink: 0, paddingLeft: 4 }}>
              {challengeExpanded ? '▲' : '▼'}
            </span>
          </div>

          {/* Expanded: full challenge + science */}
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
          <button onClick={() => setChallengeDone(false)} style={{ background:'none', border:'none', color:'var(--muted2)', cursor:'pointer', fontSize:11 }}>
            show again
          </button>
        </div>
      )}

      {/* Today progress */}
      <div className="dash-card" onClick={() => onTabChange(todaySteps.find(s=>!s.done)?.tab ?? 'daily')}>
        <div className="dash-card-header">
          <span className="dash-card-title">Today's progress</span>
          <span className="dash-card-pct" style={{ color: todayPct===100?'var(--win)':'var(--accent)' }}>{todayPct}%</span>
        </div>
        <div className="dash-today-bar-track">
          <div className="dash-today-bar-fill" style={{
            width: `${todayPct}%`,
            background: todayPct===100?'var(--win)':todayPct>=66?'var(--future)':'var(--work)',
          }} />
        </div>
        <div className="dash-today-steps">
          {todaySteps.map(s => (
            <div
              key={s.label}
              className={`dash-today-step ${s.done?'done':''}`}
              onClick={e => { e.stopPropagation(); onTabChange(s.tab as any) }}
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

      {/* Week stats */}
      <div className="dash-stats-row">
        {[
          { icon:'🏆', label:'Win rate', val: winRateWeek!=null?`${winRateWeek}%`:'—', color: winRateWeek!=null?(winRateWeek>=70?'var(--win)':winRateWeek>=40?'var(--future)':'var(--miss)'):'var(--muted2)' },
          { icon:'⚡', label:'Energy',   val: avgEnergy!=null?`${avgEnergy}`:'—', color:'var(--work)'   },
          { icon:'🎯', label:'Focus',    val: avgFocus !=null?`${avgFocus}` :'—', color:'var(--future)' },
          { icon:'😊', label:'Mood',     val: avgMood  !=null?`${avgMood}`  :'—', color:'var(--body)'   },
        ].map(s => (
          <div key={s.label} className="dash-stat-box" onClick={() => onTabChange('trends')}>
            <div className="dash-stat-icon">{s.icon}</div>
            <div className="dash-stat-val" style={{ color: s.color }}>{loading?'—':s.val}</div>
            <div className="dash-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mini week */}
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
                  background: out==='win'?'var(--win)':out==='partial'?'var(--partial)':out==='miss'?'var(--miss)':isToday?'rgba(255,213,79,0.3)':isFuture?'var(--border)':'var(--border2)',
                  boxShadow: out==='win'?'0 0 6px var(--win)':undefined,
                }} />
                <div className="dash-mini-out" style={{ color: out==='win'?'var(--win)':out==='partial'?'var(--partial)':out==='miss'?'var(--miss)':'transparent' }}>
                  {out==='win'?'✓':out==='partial'?'~':out==='miss'?'✗':''}
                </div>
              </div>
            )
          })}
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
                <div key={a.id} className="dash-ach-badge unlocked" style={{ borderColor:`${a.color}40`, background:`${a.color}10` }}>
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

      {/* ── Secondary features grid ── */}
      <div className="dash-section-label">More features</div>
      <div className="dash-feature-grid">

        <button className="dash-feature-card" onClick={() => onTabChange('week')}>
          <div className="dash-feature-icon">📅</div>
          <div className="dash-feature-body">
            <div className="dash-feature-name">Week</div>
            <div className="dash-feature-hint">
              {streak?.current ? `🔥 ${streak.current}-day streak` : 'View your 7-day grid'}
            </div>
          </div>
        </button>

        <button className="dash-feature-card" onClick={() => onTabChange('anchors')}>
          <div className="dash-feature-icon">🧭</div>
          <div className="dash-feature-body">
            <div className="dash-feature-name">Anchors</div>
            <div className="dash-feature-hint">
              {anchorsSet ? '✓ Set this week' : 'Not set yet'}
            </div>
          </div>
        </button>

        <button className="dash-feature-card" onClick={() => onTabChange('trends')}>
          <div className="dash-feature-icon">📈</div>
          <div className="dash-feature-body">
            <div className="dash-feature-name">Trends</div>
            <div className="dash-feature-hint">
              {avgEnergy ? `Energy avg ${avgEnergy}` : '30-day patterns'}
            </div>
          </div>
        </button>

        <button className="dash-feature-card" onClick={() => onTabChange('help')}>
          <div className="dash-feature-icon">❓</div>
          <div className="dash-feature-body">
            <div className="dash-feature-name">Help</div>
            <div className="dash-feature-hint">Manual & tips</div>
          </div>
        </button>

        <button className="dash-feature-card" onClick={() => onTabChange('coach')}>
          <div className="dash-feature-icon">🤖</div>
          <div className="dash-feature-body">
            <div className="dash-feature-name">Coach</div>
            <div className="dash-feature-hint">AI coaching report</div>
          </div>
        </button>

      </div>

    </div>
  )
}