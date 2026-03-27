export type DayOutcome = 'win' | 'partial' | 'miss'

export type WorkTask =
  | 'Complete a client deliverable'
  | 'Fix a pipeline / bug'
  | 'Write documentation / FRS'
  | 'Prepare for a client meeting'
  | 'Review & QA data output'
  | 'Internal team / admin task'

export type FutureTask =
  | 'Read longevity / health research'
  | 'Develop a business concept note'
  | 'Research a market or target customer'
  | 'Network / connect with someone new'
  | 'Work on a side project task'
  | 'Listen to a relevant podcast / talk'

export type BodyTask =
  | 'Gym / strength training'
  | 'Run or walk 30 min+'
  | 'Sleep 7h+ target'
  | 'Eat clean all day'
  | 'Meditate / active recovery'
  | 'No alcohol / no junk food'

export interface LogPayload {
  log_date: string
  week_start: string
  work_anchor?: string | null
  future_anchor?: string | null
  body_anchor?: string | null
  work_task: WorkTask
  future_task: FutureTask
  body_task: BodyTask
  work_done: boolean
  future_done: boolean
  body_done: boolean
  energy_level: number
  focus_level?: number | null
  mood_level?: number | null
  day_outcome?: DayOutcome | null
  tomorrow_action?: string | null
  reflection?: string | null          // NEW: optional end-of-day note
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
  current:      number   // consecutive WIN days
  longest30:    number   // longest WIN streak in last 30 days
  login_streak: number   // consecutive days with any log submitted
}

export interface AnchorWeekResponse {
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
}

// ── User profile ──────────────────────────────────────────────────────────────
export interface UserProfilePayload {
  user_id: string
  name?: string | null
  email?: string | null
  birth_year?: number | null
  gender?: string | null
  occupation?: string | null
  primary_goal?: string | null
  sleep_target_hrs?: number | null
  timezone?: string | null
}