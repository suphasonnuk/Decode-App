// Rotating motivational one-liners shown on the Today page.
// Short, action-oriented, no fluff.

export const MOTIVATIONS = [
  "One task at a time. That\u2019s all it takes.",
  "Small wins compound into big results.",
  "You don\u2019t need motivation \u2014 you need momentum.",
  "The best day starts with just one decision.",
  "Done beats perfect, every time.",
  "Show up. That\u2019s 80% of winning.",
  "What you do today writes tomorrow\u2019s story.",
  "Consistency is a superpower. Use it.",
  "Three tasks. Full focus. Let\u2019s go.",
  "Your future self will thank you for today.",
  "Discipline is choosing what you want most over what you want now.",
  "Start before you feel ready.",
  "Progress, not perfection.",
  "Make today count \u2014 you can\u2019t get it back.",
  "The streak doesn\u2019t build itself.",
  "Energy flows where focus goes.",
  "Less planning, more doing.",
  "Stack small days into an unstoppable year.",
  "You showed up. That\u2019s already a win.",
  "Keep the chain unbroken.",
]

/** Returns a deterministic quote based on the day of the year */
export function todayMotivation(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  return MOTIVATIONS[dayOfYear % MOTIVATIONS.length]
}
