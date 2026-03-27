// ── Calendar constants ────────────────────────────────────────────────────────
// Used by Week.tsx, DailyChecklist.tsx, Dashboard.tsx.
// Change language here to localize the whole app.

export const DAYS_FULL  = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export const DAYS_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
] as const

export const DAYS_MINI = [
  'S', 'M', 'T', 'W', 'T', 'F', 'S',
] as const

// ── Time-of-day periods ───────────────────────────────────────────────────────
// Used by DailyChecklist and Dashboard for smart messaging.
export type TimePeriod =
  | 'early_morning'   // 05:00 – 08:59
  | 'morning'         // 09:00 – 11:59
  | 'afternoon'       // 12:00 – 17:59
  | 'evening'         // 18:00 – 21:59
  | 'late_night'      // 22:00 – 04:59

export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5  && hour < 9)  return 'early_morning'
  if (hour >= 9  && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'late_night'
}

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  early_morning: 'Early morning',
  morning:       'Morning',
  afternoon:     'Afternoon',
  evening:       'Evening',
  late_night:    'Late night',
}

// ── Greeting by hour ──────────────────────────────────────────────────────────
export function getGreeting(hour: number): string {
  if (hour >= 5  && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  if (hour >= 18 && hour < 22) return 'Good evening'
  return 'Hey'
}