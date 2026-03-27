import { useState } from 'react'

interface Props { onDone: () => void }

const SLIDES = [
  {
    emoji: '🦞',
    title: 'Welcome to DECODE',
    sub: 'Your daily direction system',
    body: 'DECODE helps you stay focused every day in under 10 minutes. Three simple habits: set your weekly goals, log your morning, close your night.',
    cta: 'Got it, let\'s go',
  },
  {
    emoji: '☀️',
    title: 'Every morning (3 min)',
    sub: 'Open the TODAY tab',
    body: 'Pick one task for work, one step toward your future goals, and one body habit. Set your energy level. That\'s it. The app remembers what you planned the night before.',
    cta: 'Makes sense',
  },
  {
    emoji: '🌙',
    title: 'Every night (5 min)',
    sub: 'Open the NIGHT tab',
    body: 'Rate your day — WIN, PARTIAL, or MISS. Score your focus and mood. Write your first action for tomorrow so morning-you already knows what to do.',
    cta: 'I\'m ready to start',
  },
]

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const slide = SLIDES[step]

  const next = () => {
    if (step < SLIDES.length - 1) {
      setExiting(true)
      setTimeout(() => { setStep(s => s + 1); setExiting(false) }, 220)
    } else {
      setExiting(true)
      setTimeout(() => onDone(), 300)
    }
  }

  return (
    <div className="onboard-gate">
      <div className={`onboard-card ${exiting ? 'onboard-exit' : 'onboard-enter'}`}>
        <div className="onboard-emoji">{slide.emoji}</div>
        <div className="onboard-title">{slide.title}</div>
        <div className="onboard-sub">{slide.sub}</div>
        <div className="onboard-body">{slide.body}</div>
        <button className="btn-primary onboard-btn" onClick={next}>
          {slide.cta}
        </button>
        <div className="onboard-dots">
          {SLIDES.map((_, i) => (
            <div key={i} className={`onboard-dot ${i === step ? 'onboard-dot-active' : ''}`} />
          ))}
        </div>
        {step > 0 && (
          <button className="onboard-skip" onClick={onDone}>Skip intro</button>
        )}
      </div>
    </div>
  )
}
