// ── Day outcome config ────────────────────────────────────────────────────────
// Used by Night.tsx (outcome buttons), Week.tsx (pills + edit modal),
// Dashboard.tsx (mini week dots), DailyChecklist.tsx.
// Change label/desc/color here — updates everywhere.

import type { DayOutcome } from '../types'

export interface OutcomeConfig {
  id:    DayOutcome
  emoji: string
  label: string
  desc:  string
  color: string
  shortLabel: string  // used in small spaces like modal buttons
}

export const OUTCOME_CONFIGS: OutcomeConfig[] = [
  {
    id:         'win',
    emoji:      '🏆',
    label:      'Win',
    shortLabel: 'Win',
    desc:       'Completed most tasks and moved forward',
    color:      'var(--win)',
  },
  {
    id:         'partial',
    emoji:      '⚡',
    label:      'Partial',
    shortLabel: 'Partial',
    desc:       'Some progress, but not everything done',
    color:      'var(--partial)',
  },
  {
    id:         'miss',
    emoji:      '🔄',
    label:      'Miss',
    shortLabel: 'Miss',
    desc:       'Tough day — tomorrow is a fresh start',
    color:      'var(--miss)',
  },
]

// Lookup helpers
export const OUTCOME_BY_ID = Object.fromEntries(
  OUTCOME_CONFIGS.map(o => [o.id, o])
) as Record<DayOutcome, OutcomeConfig>

export const OUTCOME_IDS = OUTCOME_CONFIGS.map(o => o.id) as DayOutcome[]