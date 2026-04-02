// ── Emotion Decoder ──────────────────────────────────────────────────────────
// Granular emotion vocabulary for self-awareness.
// Users pick 1-3 emotions each night instead of just a mood number.
// Over time, patterns emerge: "You feel anxious 3x more on Mondays."

export interface Emotion {
  id: string
  label: string
  category: EmotionCategory
  color: string
  emoji: string
}

export type EmotionCategory =
  | 'positive'
  | 'calm'
  | 'driven'
  | 'uneasy'
  | 'low'
  | 'frustrated'

export const EMOTION_CATEGORIES: { id: EmotionCategory; label: string; color: string }[] = [
  { id: 'positive',   label: 'Positive',   color: 'var(--win)'     },
  { id: 'calm',       label: 'Calm',       color: 'var(--future)'  },
  { id: 'driven',     label: 'Driven',     color: 'var(--work)'    },
  { id: 'uneasy',     label: 'Uneasy',     color: 'var(--partial)' },
  { id: 'low',        label: 'Low',        color: 'var(--miss)'    },
  { id: 'frustrated', label: 'Frustrated', color: 'oklch(62% 0.18 340)' },
]

export const EMOTIONS: Emotion[] = [
  // Positive
  { id: 'happy',       label: 'Happy',       category: 'positive',   color: 'var(--win)',     emoji: '😊' },
  { id: 'grateful',    label: 'Grateful',    category: 'positive',   color: 'var(--win)',     emoji: '🙏' },
  { id: 'proud',       label: 'Proud',       category: 'positive',   color: 'var(--win)',     emoji: '💪' },
  { id: 'excited',     label: 'Excited',     category: 'positive',   color: 'var(--win)',     emoji: '🎉' },
  { id: 'connected',   label: 'Connected',   category: 'positive',   color: 'var(--win)',     emoji: '🤝' },

  // Calm
  { id: 'calm',        label: 'Calm',        category: 'calm',       color: 'var(--future)',  emoji: '😌' },
  { id: 'content',     label: 'Content',     category: 'calm',       color: 'var(--future)',  emoji: '☺️' },
  { id: 'peaceful',    label: 'Peaceful',    category: 'calm',       color: 'var(--future)',  emoji: '🕊️' },
  { id: 'reflective',  label: 'Reflective',  category: 'calm',       color: 'var(--future)',  emoji: '🪞' },
  { id: 'accepting',   label: 'Accepting',   category: 'calm',       color: 'var(--future)',  emoji: '🫶' },

  // Driven
  { id: 'focused',     label: 'Focused',     category: 'driven',     color: 'var(--work)',    emoji: '🎯' },
  { id: 'determined',  label: 'Determined',  category: 'driven',     color: 'var(--work)',    emoji: '🔥' },
  { id: 'ambitious',   label: 'Ambitious',   category: 'driven',     color: 'var(--work)',    emoji: '🚀' },
  { id: 'curious',     label: 'Curious',     category: 'driven',     color: 'var(--work)',    emoji: '🔍' },
  { id: 'creative',    label: 'Creative',    category: 'driven',     color: 'var(--work)',    emoji: '✨' },

  // Uneasy
  { id: 'anxious',     label: 'Anxious',     category: 'uneasy',     color: 'var(--partial)', emoji: '😰' },
  { id: 'overwhelmed', label: 'Overwhelmed', category: 'uneasy',     color: 'var(--partial)', emoji: '🤯' },
  { id: 'restless',    label: 'Restless',    category: 'uneasy',     color: 'var(--partial)', emoji: '😤' },
  { id: 'uncertain',   label: 'Uncertain',   category: 'uneasy',     color: 'var(--partial)', emoji: '🤔' },
  { id: 'pressured',   label: 'Pressured',   category: 'uneasy',     color: 'var(--partial)', emoji: '😬' },

  // Low
  { id: 'tired',       label: 'Tired',       category: 'low',        color: 'var(--miss)',    emoji: '😴' },
  { id: 'lonely',      label: 'Lonely',      category: 'low',        color: 'var(--miss)',    emoji: '🥀' },
  { id: 'sad',         label: 'Sad',         category: 'low',        color: 'var(--miss)',    emoji: '😢' },
  { id: 'numb',        label: 'Numb',        category: 'low',        color: 'var(--miss)',    emoji: '😶' },
  { id: 'drained',     label: 'Drained',     category: 'low',        color: 'var(--miss)',    emoji: '🪫' },

  // Frustrated
  { id: 'frustrated',  label: 'Frustrated',  category: 'frustrated', color: 'oklch(62% 0.18 340)', emoji: '😠' },
  { id: 'irritated',   label: 'Irritated',   category: 'frustrated', color: 'oklch(62% 0.18 340)', emoji: '😒' },
  { id: 'impatient',   label: 'Impatient',   category: 'frustrated', color: 'oklch(62% 0.18 340)', emoji: '⏳' },
  { id: 'stuck',       label: 'Stuck',       category: 'frustrated', color: 'oklch(62% 0.18 340)', emoji: '🧱' },
  { id: 'disappointed',label: 'Disappointed',category: 'frustrated', color: 'oklch(62% 0.18 340)', emoji: '😞' },
]

export function getEmotionById(id: string): Emotion | undefined {
  return EMOTIONS.find(e => e.id === id)
}

export function getEmotionsByCategory(cat: EmotionCategory): Emotion[] {
  return EMOTIONS.filter(e => e.category === cat)
}
