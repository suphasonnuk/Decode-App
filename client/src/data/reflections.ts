// ── Reflection Prompts ───────────────────────────────────────────────────────
// Deep, rotating questions for self-awareness. One shown per day.
// Categories: self, career, patterns, values, relationships, growth

export interface ReflectionPrompt {
  question: string
  category: 'self' | 'career' | 'patterns' | 'values' | 'relationships' | 'growth'
}

export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  // Self-awareness
  { question: 'What emotion did you avoid feeling today, and why?', category: 'self' },
  { question: 'If someone watched your entire day, what would they say your real priorities are?', category: 'self' },
  { question: 'What are you pretending not to know about yourself right now?', category: 'self' },
  { question: 'When did you feel most like yourself today? When did you feel least like yourself?', category: 'self' },
  { question: 'What story are you telling yourself about today that might not be entirely true?', category: 'self' },
  { question: 'What would the 10-year-ago version of you think about how today went?', category: 'self' },
  { question: 'What did you do today out of habit vs. out of intention?', category: 'self' },

  // Career & work
  { question: 'Did your work today move you toward the person you want to become, or just the role you currently have?', category: 'career' },
  { question: 'What skill gap became obvious today that you keep ignoring?', category: 'career' },
  { question: 'If you could redesign your job from scratch, what would you keep? What would you drop?', category: 'career' },
  { question: 'What is the most important problem you could be solving but are not?', category: 'career' },
  { question: 'Are you building something that matters to you, or just completing tasks?', category: 'career' },

  // Pattern recognition
  { question: 'What pattern repeated today that you have seen before?', category: 'patterns' },
  { question: 'What triggers made you lose focus or energy today? Are they the same as last week?', category: 'patterns' },
  { question: 'When did you procrastinate today, and what were you really avoiding?', category: 'patterns' },
  { question: 'What is one thing you keep saying you will do but never actually do?', category: 'patterns' },
  { question: 'If you could plot your mood throughout the day, where were the peaks and valleys? Why?', category: 'patterns' },

  // Values alignment
  { question: 'Did your actions today align with what you say you value most?', category: 'values' },
  { question: 'What would you have done differently today if no one was watching?', category: 'values' },
  { question: 'What did you say yes to today that you should have said no to?', category: 'values' },
  { question: 'What does "success" actually mean to you right now? Has it changed?', category: 'values' },
  { question: 'If you had to describe your life philosophy in one sentence based on today, what would it be?', category: 'values' },

  // Relationship with self
  { question: 'How did you talk to yourself today? Would you talk to a friend that way?', category: 'relationships' },
  { question: 'What do you need right now that you are not giving yourself?', category: 'relationships' },
  { question: 'Who did you compare yourself to today? Was it helpful?', category: 'relationships' },
  { question: 'What boundary did you set today, or wish you had?', category: 'relationships' },
  { question: 'When did you feel genuinely connected to another person today?', category: 'relationships' },

  // Growth
  { question: 'What is one uncomfortable truth you learned about yourself today?', category: 'growth' },
  { question: 'What did you fail at today, and what does that failure teach you?', category: 'growth' },
  { question: 'What is the smallest change you could make tomorrow that would have the biggest impact?', category: 'growth' },
  { question: 'What are you afraid to try, and what is the worst that could realistically happen?', category: 'growth' },
  { question: 'If you repeated today exactly for a year, where would you end up?', category: 'growth' },
  { question: 'What part of yourself are you outgrowing?', category: 'growth' },
]

/** Get today's reflection prompt — deterministic rotation by day-of-year */
export function getTodayPrompt(): ReflectionPrompt {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
  return REFLECTION_PROMPTS[dayOfYear % REFLECTION_PROMPTS.length]
}
