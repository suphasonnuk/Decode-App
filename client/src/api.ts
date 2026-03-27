import type { LogPayload, LogRow, HealthResponse, TrendPoint, StreakResponse, WeekAnchors } from './types'
import type { UserProfile } from './store'
import { getAuthToken, getUserId } from './store'

const BASE = '/api'

function authHeaders(userId?: string): HeadersInit {
  const token = getAuthToken()
  const uid   = userId || getUserId()
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) base['x-app-token']  = token
  if (uid)   base['x-user-id']    = uid
  return base
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || res.statusText) }
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(body),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || res.statusText) }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: authHeaders() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health:         () => get<HealthResponse>('/health'),
  saveLog:        (payload: LogPayload) => post<{ success: boolean; log_date?: string; error?: string }>('/log', payload),
  getWeek:        (start?: string) => get<LogRow[]>(start ? `/week?start=${start}` : '/week'),
  getToday:       () => get<LogRow | null>('/today'),
  getYesterday:   () => get<{ tomorrow_action: string | null }>('/yesterday'),
  getWeekAnchors: () => get<WeekAnchors | null>('/anchors/week'),
  getStreak:      () => get<StreakResponse>('/streak'),
  getTrends:      () => get<TrendPoint[]>('/trends'),
  getHistory:     () => get<LogRow[]>('/history'),
  getProfile:     (userId: string) => get<UserProfile | null>(`/profile/${userId}`),
  saveProfile:    (profile: UserProfile) => post<{ success: boolean; error?: string }>('/profile', profile),

  // AI Coach — returns personalized analysis from Claude + BigQuery
  getCoaching: (userId: string) =>
    post<{
      greeting: string; summary: string; patterns: string[];
      action: string; score: number | null; data_points: number; win_rate: number
    }>('/coach', { user_id: userId }),

  // Push notifications
  subscribePush: (userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    post<{ success: boolean }>('/push/subscribe', {
      user_id:  userId,
      endpoint: sub.endpoint,
      keys:     sub.keys,
    }),

  // Nutrition tracker
  analyzeNutrition: (payload: { image_base64?: string; image_media_type?: string; dish_name?: string }) =>
    post<{
      success:   boolean
      nutrition: NutritionFacts
      source:    string
    }>('/nutrition/analyze', payload),

  logNutrition: (entry: NutritionEntry) =>
    post<{ success: boolean; entry_id: string }>('/nutrition/log', entry),

  getNutritionToday: (userId: string) =>
    get<{ entries: NutritionEntry[]; totals: NutritionTotals }>(`/nutrition/today?user_id=${userId}`),

  editNutritionEntry: (entryId: string, payload: Partial<NutritionEntry>) =>
    put<{ success: boolean; entry_id: string }>(`/nutrition/entry/${entryId}`, payload),

  deleteNutritionEntry: (entryId: string) =>
    del<{ success: boolean }>(`/nutrition/entry/${entryId}`),

  getNutritionHistory: (userId: string, days = 30) =>
    get<NutritionDaySummary[]>(`/nutrition/history?user_id=${userId}&days=${days}`),

  // ── Presence ───────────────────────────────────────────────────────────────────
  heartbeat: (userId: string, displayName?: string) =>
    post<{ ok: boolean }>('/heartbeat', { user_id: userId, display_name: displayName }),

  getUsersPresence: () =>
    get<{
      user_id: string; display_name: string; last_seen: string | null;
      day_outcome: string | null; energy_level: number | null;
      status: 'online' | 'recent' | 'away' | 'offline'; is_me: boolean
    }[]>('/users/presence'),

  // ── Challenge + Weekly Story ──────────────────────────────────────────────────
  getChallenge:   () => get<{
    category: string; icon: string; observation: string;
    challenge: string; science: string; source: string; difficulty: string
  }>('/challenge'),

  getWeeklyStory: () => get<{
    headline: string; story: string; score: number | null;
    pattern: string | null; next_week: string;
    stats: Record<string, string>; days_logged: number; win_rate: number
  }>('/weekly-story'),

  // ── Coffee ─────────────────────────────────────────────────────────────────
  logCoffee: (payload: { user_id: string; coffee_type: string; roast: string; dose_g?: number; yield_g?: number }) =>
    post<{ success: boolean; entry_id: string }>('/coffee/log', payload),

  getCoffeeToday: (userId: string) =>
    get<CoffeeEntry[]>(`/coffee/today?user_id=${userId}`),

  getCoffeeHistory: (userId: string, days = 30) =>
    get<{ log_date: string; cups: number; types: string; roasts: string }[]>(`/coffee/history?user_id=${userId}&days=${days}`),
}

// ── Nutrition types ───────────────────────────────────────────────────────────
export interface HealthImpact {
  rating:     'positive' | 'neutral' | 'mixed' | 'negative'
  summary:    string
  highlights: string[]
  watch:      string | null
}

export interface NutritionFacts {
  dish_name:           string
  serving_description: string
  calories:            number | null
  protein_g:           number | null
  carbs_g:             number | null
  fat_g:               number | null
  fiber_g:             number | null
  sugar_g:             number | null
  sodium_mg:           number | null
  confidence:          'high' | 'medium' | 'low'
  notes:               string
  health_impact:       HealthImpact | null
}

export interface NutritionEntry {
  entry_id?:     string
  user_id:       string
  log_date?:     string
  meal_type:     string
  dish_name:     string
  calories:      number | null
  protein_g:     number | null
  carbs_g:       number | null
  fat_g:         number | null
  fiber_g:       number | null
  sugar_g:       number | null
  sodium_mg:     number | null
  source:        string
  notes?:        string
  ai_analysis?:  string
  health_impact?: HealthImpact | null   // stored in ai_analysis JSON, parsed on load
}

export interface NutritionTotals {
  calories:  number
  protein_g: number
  carbs_g:   number
  fat_g:     number
  fiber_g:   number
  sugar_g:   number
  sodium_mg: number
}

export interface CoffeeEntry {
  entry_id:    string
  log_date:    string
  logged_at:   string
  coffee_type: string
  roast:       string
  dose_g:      number | null
  yield_g:     number | null
  notes:       string | null
}

export interface NutritionDaySummary {
  log_date:        string
  meal_count:      number
  total_calories:  number
  total_protein_g: number
  total_carbs_g:   number
  total_fat_g:     number
  total_fiber_g:   number
}