import { useEffect, useState } from 'react'
import type { Achievement } from '../achievements'

interface Props {
  achievement: Achievement
  onDone: () => void
}

export default function AchievementPopup({ achievement, onDone }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slight delay so it feels surprising
    const t1 = setTimeout(() => setVisible(true), 100)
    // Auto-dismiss after 4s
    const t2 = setTimeout(() => { setVisible(false); setTimeout(onDone, 400) }, 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`achievement-overlay ${visible ? 'achievement-visible' : ''}`}>
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
