// ── Slider configuration ──────────────────────────────────────────────────────
// Used by Today.tsx (energy) and Night.tsx (focus + mood).
// Edit labels/colors/breakpoints here — updates everywhere.

// ── Energy (logged in morning) ────────────────────────────────────────────────
export interface EnergyLabel {
  label: string
  color: string
  emoji: string
}

export const ENERGY_LABELS: Record<number, EnergyLabel> = {
  1:  { label: 'Completely drained',  color: '#ef5350', emoji: '😴' },
  2:  { label: 'Very low energy',     color: '#ef5350', emoji: '😓' },
  3:  { label: 'Low energy',          color: '#ff8a65', emoji: '😕' },
  4:  { label: 'Slightly tired',      color: '#ffb74d', emoji: '😐' },
  5:  { label: 'Neutral',             color: '#ffd54f', emoji: '😶' },
  6:  { label: 'Decent energy',       color: '#dce775', emoji: '🙂' },
  7:  { label: 'Good energy',         color: '#aed581', emoji: '😊' },
  8:  { label: 'High energy',         color: '#81c784', emoji: '😄' },
  9:  { label: 'Very energized',      color: '#4db6ac', emoji: '🤩' },
  10: { label: 'Peak energy',         color: '#4fc3f7', emoji: '⚡' },
}

// ── Night sliders (focus + mood) ──────────────────────────────────────────────
export interface SliderConfig {
  key:   'focus' | 'mood'
  label: string
  desc:  string
  scaleMin: string   // label for left end
  scaleMax: string   // label for right end
  levels: Record<number, string>  // threshold → description
  color: (v: number) => string    // dynamic color based on value
}

export const NIGHT_SLIDER_CONFIGS: SliderConfig[] = [
  {
    key:      'focus',
    label:    'Focus Level',
    desc:     'How well could you concentrate today?',
    scaleMin: 'Scattered',
    scaleMax: 'Deep focus',
    levels: {
      1:  'Completely scattered',
      3:  'Very distracted',
      5:  'Somewhat focused',
      7:  'Good focus',
      9:  'Deep work',
      10: 'Peak concentration',
    },
    color: (v: number) => v >= 8 ? 'var(--future)' : v >= 5 ? '#dce775' : 'var(--miss)',
  },
  {
    key:      'mood',
    label:    'Mood Level',
    desc:     'How did you feel overall today?',
    scaleMin: 'Very low',
    scaleMax: 'Excellent',
    levels: {
      1:  'Very low',
      3:  'Down',
      5:  'Neutral',
      7:  'Good',
      9:  'Great',
      10: 'Excellent',
    },
    color: (v: number) => v >= 8 ? 'var(--body)' : v >= 5 ? '#dce775' : 'var(--miss)',
  },
]

// ── Shared helper — find the label for a slider value ─────────────────────────
export function getSliderLabel(
  levels: Record<number, string>,
  value: number
): string {
  const keys = Object.keys(levels).map(Number).sort((a, b) => a - b)
  let closest = keys[0]
  for (const k of keys) { if (value >= k) closest = k }
  return levels[closest]
}