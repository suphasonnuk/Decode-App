import { useEffect, useState } from 'react'
import type { Achievement } from '../achievements'
import Confetti from './Confetti'
import { hapticHeavy } from '../lib/haptics'

interface Props {
  achievement: Achievement
  onDone: () => void
}

export default function AchievementPopup({ achievement, onDone }: Props) {
  const [visible, setVisible] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => { setVisible(true); setShowConfetti(true); hapticHeavy() }, 100)
    const t2 = setTimeout(() => { setVisible(false); setTimeout(onDone, 400) }, 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`achievement-overlay ${visible ? 'achievement-visible' : ''}`}>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="achievement-popup">
        <div className="achievement-shine" />
        <div className="achievement-emoji">{achievement.emoji}</div>
        <div className="achievement-label">Achievement unlocked</div>
        <div className="achievement-title" style={{ color: achievement.color }}>
          {achievement.title}
        </div>
        <div className="achievement-desc">{achievement.desc}</div>
        <button className="achievement-dismiss" onClick={() => { setVisible(false); setTimeout(onDone, 300) }}>
          Nice!
        </button>
      </div>
    </div>
  )
}
