// date-fns wrapper — replaces all manual date string math in store.ts
// All functions return YYYY-MM-DD strings in local timezone (Bangkok safe)

import {
  format,
  subDays,
  startOfWeek,
  addWeeks,
  eachDayOfInterval,
  isAfter,
  isSameDay,
  parseISO,
  getDay,
  getHours,
} from 'date-fns'

const DATE_FMT = 'yyyy-MM-dd'

// ── Core date strings ─────────────────────────────────────────────────────────
export const localToday     = (): string => format(new Date(), DATE_FMT)
export const localYesterday = (): string => format(subDays(new Date(), 1), DATE_FMT)
export const localWeekStart = (): string => format(startOfWeek(new Date(), { weekStartsOn: 0 }), DATE_FMT)

// Week start for any offset (0 = this week, -1 = last week, etc.)
export const weekStartForOffset = (offset: number): string =>
  format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 0 }), offset), DATE_FMT)

// 7 dates starting from a given week start
export const weekDatesFrom = (weekStart: string): string[] => {
  const start = parseISO(weekStart)
  const end   = addWeeks(start, 1)
  return eachDayOfInterval({ start, end: subDays(end, 1) })
    .map(d => format(d, DATE_FMT))
}

// Parse BigQuery date (may come back as { value: 'YYYY-MM-DD' } or string)
export const parseBQDate = (val: unknown): string =>
  val && typeof val === 'object' && 'value' in (val as object)
    ? (val as { value: string }).value
    : (val as string)

// ── Comparison helpers ────────────────────────────────────────────────────────
export const isDateAfterToday  = (date: string): boolean => isAfter(parseISO(date), new Date())
export const isDateToday       = (date: string): boolean => isSameDay(parseISO(date), new Date())
export const dayOfWeek         = (date: string): number  => getDay(parseISO(date))
export const currentHour       = (): number => getHours(new Date())
export const isSunday          = (): boolean => getDay(new Date()) === 0

// ── Formatted labels ──────────────────────────────────────────────────────────
export const todayLongLabel = (): string =>
  format(new Date(), 'EEEE, MMMM d')

export const weekRangeLabel = (weekStart: string): string => {
  const start = parseISO(weekStart)
  const end   = subDays(addWeeks(start, 1), 1)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}