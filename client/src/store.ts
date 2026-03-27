import type { WeekAnchors, LogPayload, DayOutcome } from './types'
import {
  localToday as todayStr,
  localYesterday as yesterdayStr,
  localWeekStart as weekStartStr,
  weekStartForOffset,
  weekDatesFrom,
  parseBQDate,
} from './lib/dates'

// Re-export date utilities for consumers that import from store
export { todayStr, yesterdayStr, weekStartStr, weekStartForOffset, parseBQDate }

// weekDates wrapper: accepts optional weekStart, defaults to current week
export const weekDates = (weekStart?: string): string[] =>
  weekDatesFrom(weekStart ?? weekStartStr())

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsSet<T>(key: string, v: T): void { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
function lsGet<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null } catch { return null }
}

// Prune day-cache keys older than 35 days — prevents localStorage filling up over time
function pruneOldCaches(): void {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 35)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const prefixes = ['today_', 'night_', 'anch_']
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i) || ''
      const prefix = prefixes.find(p => key.startsWith(p))
      if (prefix) {
        const dateStr = key.slice(prefix.length)
        if (dateStr < cutoffStr) localStorage.removeItem(key)
      }
    }
  } catch {}
}
// Run once on load — silent, non-blocking
setTimeout(pruneOldCaches, 2000)

// ── Auth token ────────────────────────────────────────────────────────────────
const AUTH_KEY = 'decode_auth_token'
export const getAuthToken  = (): string | null => localStorage.getItem(AUTH_KEY)
export const setAuthToken  = (t: string): void  => localStorage.setItem(AUTH_KEY, t)
export const clearAuthToken = (): void           => localStorage.removeItem(AUTH_KEY)

// ── Anchors ───────────────────────────────────────────────────────────────────
export const getAnchors  = (): WeekAnchors => lsGet<WeekAnchors>('anch_'+weekStartStr()) ?? {work:'',future:'',body:''}
export const saveAnchors = (a: WeekAnchors): void => lsSet('anch_'+weekStartStr(), a)

// ── Today cache ───────────────────────────────────────────────────────────────
export const getTodayCache  = (): Partial<LogPayload> => lsGet<Partial<LogPayload>>('today_'+todayStr()) ?? {}
export const saveTodayCache = (d: Partial<LogPayload>): void => lsSet('today_'+todayStr(), d)

// ── Night cache ───────────────────────────────────────────────────────────────
interface NightCache {
  outcome: DayOutcome | null
  focus_level: number
  mood_level: number
  tomorrow_action: string
  reflection: string
}
export const getNightCache  = (): NightCache => lsGet<NightCache>('night_'+todayStr()) ?? {outcome:null,focus_level:5,mood_level:5,tomorrow_action:'',reflection:''}
export const saveNightCache = (d: NightCache): void => lsSet('night_'+todayStr(), d)

// ── Per-day cache (used by week view fallback) ────────────────────────────────
export const getDayCache          = (date: string): Partial<LogPayload> => lsGet<Partial<LogPayload>>('today_'+date) ?? {}
export const getNightCacheForDate = (date: string): NightCache | null   => lsGet<NightCache>('night_'+date)

// ── User ID — persistent UUID, generated once per device, stored forever ────────
// This is the primary key that scopes ALL BigQuery rows to one device/user.
// Two phones = two user IDs = completely separate data. By design.
// crypto.randomUUID() is cryptographically secure (available in all modern browsers).
function generateUUID(): string {
  // Use crypto.randomUUID() if available (Chrome 92+, Firefox 95+, Safari 15.4+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for very old browsers — still works, slightly less entropy
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getUserId(): string {
  try {
    const existing = localStorage.getItem('decode_user_id')
    if (existing) return existing
    const id = generateUUID()
    localStorage.setItem('decode_user_id', id)
    return id
  } catch { return 'anonymous' }
}

// ── User profile (local cache) ────────────────────────────────────────────────
export interface UserProfile {
  user_id:                string
  name:                   string
  email:                  string
  birth_year:             number | null
  gender:                 string
  occupation:             string
  primary_goal:           string
  sleep_target_hrs:       number | null
  timezone:               string
  // Body metrics for TDEE calculation
  height_cm:              number | null
  weight_kg:              number | null
  exercise_days_per_week: number | null
  fitness_goal:           string
}

// ── TDEE Calculator — Mifflin-St Jeor ─────────────────────────────────────────
// Source: Mifflin et al. (1990) Am J Clin Nutr 51(2):241-7
// Activity factors: FAO/WHO/UNU Expert Consultation (2001)
// Macro refs: Morton et al. (2018) BJSM — protein 2.0g/kg for active adults
//             IOM Dietary Reference Intakes (2002) — fiber 38g/25g
//             WHO/AHA (2023) — sodium ≤ 2300mg/day
export interface NutritionTargets {
  calories:  number   // TDEE adjusted for goal (kcal)
  protein_g: number   // 2.0g per kg bodyweight
  carbs_g:   number   // remaining after protein + fat
  fat_g:     number   // 30% of TDEE
  fiber_g:   number   // 38g men / 25g women
  sodium_mg: number   // 2300mg
  bmr:       number   // basal metabolic rate (kcal, for display)
  tdee:      number   // total daily energy expenditure before goal adjust
}

export function calculateNutritionTargets(profile: UserProfile): NutritionTargets {
  const defaults: NutritionTargets = {
    calories: 2000, protein_g: 130, carbs_g: 250,
    fat_g: 65, fiber_g: 30, sodium_mg: 2300, bmr: 0, tdee: 2000,
  }

  const { height_cm, weight_kg, birth_year, gender, exercise_days_per_week, fitness_goal } = profile
  if (!height_cm || !weight_kg || !birth_year) return defaults

  // Step 1 — Mifflin-St Jeor BMR
  const age    = new Date().getFullYear() - birth_year
  const isMale = gender === 'male'
  const bmr    = Math.round((10 * weight_kg) + (6.25 * height_cm) - (5 * age) + (isMale ? 5 : -161))

  // Step 2 — Physical Activity Level multiplier
  const days = exercise_days_per_week ?? 0
  const pal  = days === 0 ? 1.2 : days <= 2 ? 1.375 : days <= 4 ? 1.55 : days <= 6 ? 1.725 : 1.9
  const tdee = Math.round(bmr * pal)

  // Step 3 — Goal calorie adjustment
  const adj      = fitness_goal === 'lose_weight' ? -400 : fitness_goal === 'gain_muscle' ? 300 : 0
  const calories = Math.max(tdee + adj, 1200) // floor at 1200kcal

  // Step 4 — Macros
  const protein_g    = Math.round(weight_kg * 2.0)
  const fat_g        = Math.round((calories * 0.30) / 9)
  const carbs_g      = Math.max(Math.round((calories - protein_g * 4 - fat_g * 9) / 4), 50)
  const fiber_g      = isMale ? 38 : 25

  return { calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg: 2300, bmr, tdee }
}

const PROFILE_KEY = 'decode_user_profile'

export function getProfileCache(): UserProfile {
  const defaults: Partial<UserProfile> = {
    height_cm: null, weight_kg: null,
    exercise_days_per_week: null, fitness_goal: 'maintain',
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) } as UserProfile
  } catch {}
  return {
    user_id:                getUserId(),
    name:                   '',
    email:                  '',
    birth_year:             null,
    gender:                 '',
    occupation:             '',
    primary_goal:           '',
    sleep_target_hrs:       null,
    timezone:               Intl.DateTimeFormat().resolvedOptions().timeZone,
    height_cm:              null,
    weight_kg:              null,
    exercise_days_per_week: null,
    fitness_goal:           'maintain',
  }
}

export function saveProfileCache(p: UserProfile): void {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

// ── Smart task defaults — track task selection frequency ──────────────────────
const FREQ_KEY = 'decode_task_freq'

type TaskFrequency = Record<string, Record<string, number>>

function getTaskFreq(): TaskFrequency {
  return lsGet<TaskFrequency>(FREQ_KEY) ?? {}
}

/** Call when user selects a task to bump its frequency count */
export function bumpTaskFreq(category: string, task: string): void {
  if (!task) return
  const freq = getTaskFreq()
  if (!freq[category]) freq[category] = {}
  freq[category][task] = (freq[category][task] || 0) + 1
  lsSet(FREQ_KEY, freq)
}

/** Returns task options sorted by frequency (most used first), with unselected tasks after */
export function sortedTaskOptions(category: string, options: readonly string[]): string[] {
  const freq = getTaskFreq()[category] ?? {}
  return [...options].sort((a, b) => (freq[b] || 0) - (freq[a] || 0))
}

// ── Streak freeze — one free pass per week ───────────────────────────────────
const FREEZE_KEY = 'decode_streak_freeze'

interface FreezeState {
  available: number   // freezes remaining (max 1)
  lastRefill: string  // week_start date when last refilled
  usedOn: string[]    // dates freeze was used
}

function getFreezeState(): FreezeState {
  const ws = weekStartStr()
  const state = lsGet<FreezeState>(FREEZE_KEY) ?? { available: 1, lastRefill: ws, usedOn: [] }
  // Auto-refill once per week
  if (state.lastRefill !== ws) {
    state.available = 1
    state.lastRefill = ws
    state.usedOn = []
    lsSet(FREEZE_KEY, state)
  }
  return state
}

export function getStreakFreezeCount(): number {
  return getFreezeState().available
}

export function useStreakFreeze(): boolean {
  const state = getFreezeState()
  if (state.available <= 0) return false
  state.available = 0
  state.usedOn.push(todayStr())
  lsSet(FREEZE_KEY, state)
  return true
}