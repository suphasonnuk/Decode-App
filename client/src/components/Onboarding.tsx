import { useState } from 'react'

interface Props { onDone: () => void }

const SLIDES = [
  {
    emoji: '🎯',
    title: 'Welcome to DECODE',
    sub: 'Direction · Execute · Close · Observe · Develop · Evolve',
    body: 'DECODE is a system for people who want clarity, not noise. Each letter is a step: set Direction, Execute your plan, Close the day, Observe your data, Develop better habits, and Evolve week over week.',
    cta: 'Tell me more',
  },
  {
    emoji: '☀️',
    title: 'Direction + Execute',
    sub: 'Every morning — 3 min',
    body: 'Each morning you set Direction: pick one task for Work, one for your Future, one for your Body. Then you Execute — go do them. The app tracks what you planned so evening-you can judge honestly.',
    cta: 'Makes sense',
  },
  {
    emoji: '🌙',
    title: 'Close + Observe',
    sub: 'Every evening — 5 min',
    body: 'Close the day: WIN, PARTIAL, or MISS. Score your focus and mood. Then Observe — the dashboard shows your patterns over time. Write tomorrow\'s first action so morning-you already has Direction.',
    cta: 'Got it',
  },
  {
    emoji: '📈',
    title: 'Develop + Evolve',
    sub: 'Every week — 5 min',
    body: 'On Sundays, set your 3 weekly anchors — your compass for Work, Future, and Body. Review your week, spot what worked, and adjust. Small corrections compound. That\'s how you Evolve.',
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
