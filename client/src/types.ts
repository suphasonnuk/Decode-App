// ── Core domain types ─────────────────────────────────────────────────────────
// Task types are derived from the data files — change options in data/tasks.ts

export type DayOutcome = 'win' | 'partial' | 'miss'

// Re-export task types for backward compat — actual arrays live in data/tasks.ts
export type { WorkTask, FutureTask, BodyTask } from './data/tasks'
export { WORK_TASKS, FUTURE_TASKS, BODY_TASKS } from './data/tasks'
export { GENDER_OPTIONS, GOAL_OPTIONS, SLEEP_OPTIONS } from './data/profile'

export interface LogPayload {
  log_date: string
  week_start: string
  work_anchor?: string | null
  future_anchor?: string | null
  body_anchor?: string | null
  work_task: string
  future_task: string
  body_task: string
  work_done: boolean
  future_done: boolean
  body_done: boolean
  energy_level: number
  focus_level?: number | null
  mood_level?: number | null
  day_outcome?: DayOutcome | null
  tomorrow_action?: string | null
  reflection?: string | null
}

export interface LogRow extends LogPayload {
  submitted_at: string
}

export interface TrendPoint {
  log_date: string
  energy_level: number | null
  focus_level: number | null
  mood_level: number | null
  day_outcome: string | null
}

export interface StreakResponse {
  current: number
  longest30: number
  login_streak: number   // ✅ ADD THIS
}
export interface WeekAnchors {
  work: string
  future: string
  body: string
}

export interface HealthResponse {
  status: 'ok'
  project: string
  dataset: string
  table: string
  env: string
  auth: boolean
}

export type Tab = 'anchors' | 'daily' | 'night' | 'week' | 'trends'