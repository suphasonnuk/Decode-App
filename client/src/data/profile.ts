// ── Profile field options ─────────────────────────────────────────────────────
// Edit these to add/remove choices in the profile editor.

export const GENDER_OPTIONS = [
  { value: 'male',              label: 'Male'              },
  { value: 'female',            label: 'Female'            },
  { value: 'other',             label: 'Other'             },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export const GOAL_OPTIONS = [
  { value: 'work_performance', label: '💼 Work performance'       },
  { value: 'future_business',  label: '🚀 Build a future business' },
  { value: 'health',           label: '💪 Health & longevity'      },
  { value: 'all_three',        label: '🎯 All three'               },
] as const

export const SLEEP_OPTIONS = [5, 6, 7, 8, 9] as const

export const OCCUPATION_SUGGESTIONS = [
  'Data Engineer',
  'Software Engineer',
  'Product Manager',
  'Consultant',
  'Business Analyst',
  'Designer',
  'Entrepreneur',
  'Student',
  'Marketing',
  'Finance',
]

// ── Exercise frequency options ────────────────────────────────────────────────
export const EXERCISE_DAYS_OPTIONS = [
  { value: 0, label: 'Sedentary — little or no exercise',            factor: 1.2   },
  { value: 2, label: 'Light — 1–2 days/week',                        factor: 1.375 },
  { value: 3, label: 'Moderate — 3–4 days/week',                     factor: 1.55  },
  { value: 5, label: 'Active — 5–6 days/week',                       factor: 1.725 },
  { value: 7, label: 'Very active — daily + physical job',           factor: 1.9   },
] as const

// ── Fitness goal options ──────────────────────────────────────────────────────
export const FITNESS_GOAL_OPTIONS = [
  { value: 'lose_weight',   label: '🔥 Lose weight',      kcal_adjust: -400 },
  { value: 'maintain',      label: '⚖️ Maintain weight',  kcal_adjust: 0    },
  { value: 'gain_muscle',   label: '💪 Gain muscle',      kcal_adjust: +300 },
] as const

export type FitnessGoal = typeof FITNESS_GOAL_OPTIONS[number]['value']