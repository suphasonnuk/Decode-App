// ── Task options ──────────────────────────────────────────────────────────────
// Each category has 15 choices. Add or remove freely — components pull from here.
// Keep choices action-oriented and completable in one day.

export const WORK_TASKS = [
  'Complete a client deliverable',
  'Fix a pipeline or bug',
  'Write documentation or FRS',
  'Prepare for a client meeting',
  'Review and QA data output',
  'Internal team or admin task',
  'Write or review SQL queries',
  'Build or update a dashboard',
  'Code review or peer review',
  'Plan sprint or backlog grooming',
  'Research a technical solution',
  'Respond to stakeholder emails',
  'Deploy or test a feature',
  'Investigate a data quality issue',
  'Write a status update or report',
] as const

export const FUTURE_TASKS = [
  'Read longevity or health research',
  'Develop a business concept note',
  'Research a market or target customer',
  'Network or connect with someone new',
  'Work on a side project task',
  'Listen to a relevant podcast or talk',
  'Write a journal entry or reflection',
  'Study a new skill or tool',
  'Outline a product or service idea',
  'Read a chapter of a business book',
  'Create content or share an insight',
  'Set a financial goal or review savings',
  'Reach out to a potential mentor',
  'Map out a personal roadmap step',
  'Attend an online course or webinar',
] as const

export const BODY_TASKS = [
  'Gym or strength training',
  'Run or walk 30 min or more',
  'Sleep 7 hours or more target',
  'Eat clean all day',
  'Meditate or active recovery',
  'No alcohol and no junk food',
  'Swim or cycle session',
  'Stretching or yoga session',
  'Cold shower or ice bath',
  'Track calories or macros all day',
  'Drink 2.5L water minimum',
  'Skip sugar all day',
  'Get 8000 steps or more',
  'Early sleep before 10pm',
  'Intermittent fasting today',
] as const

export type WorkTask   = typeof WORK_TASKS[number]
export type FutureTask = typeof FUTURE_TASKS[number]
export type BodyTask   = typeof BODY_TASKS[number]

// ── Category meta — used by Today, Anchors, Week ─────────────────────────────
export const TASK_CATEGORIES = [
  {
    key:     'work'   as const,
    label:   'Work Task',
    icon:    '💼',
    color:   'var(--work)',
    hint:    'What is the one work thing that would make today a success?',
    anchor_hint: 'What is the one work goal that would make this week a success?',
  },
  {
    key:     'future' as const,
    label:   'Future Goal',
    icon:    '🚀',
    color:   'var(--future)',
    hint:    'One step toward your future business or personal growth goal.',
    anchor_hint: 'One action toward your longevity business or personal growth goal.',
  },
  {
    key:     'body'   as const,
    label:   'Body Habit',
    icon:    '💪',
    color:   'var(--body)',
    hint:    'Your physical habit for today — exercise, sleep, or nutrition.',
    anchor_hint: 'Your physical commitment this week — exercise, sleep, or nutrition.',
  },
] as const

export type TaskCategoryKey = typeof TASK_CATEGORIES[number]['key']

// ── Task options map — used by dropdowns ─────────────────────────────────────
export const TASK_OPTIONS: Record<TaskCategoryKey, readonly string[]> = {
  work:   WORK_TASKS,
  future: FUTURE_TASKS,
  body:   BODY_TASKS,
}