import { useState } from 'react'
import Night from './Night'
import Week from './Week'
import Anchors from './Anchors'

interface Props {
  onToast: (msg: string, isError?: boolean) => void
  weekKey: number
}

export default function Review({ onToast, weekKey }: Props) {
  const [view, setView] = useState<'tonight' | 'week' | 'anchors'>('tonight')

  return (
    <div>
      {/* Segment control */}
      <div className="review-segment-control">
        <button
          className={`review-segment-btn ${view === 'tonight' ? 'review-segment-active' : ''}`}
          onClick={() => setView('tonight')}
        >
          Tonight
        </button>
        <button
          className={`review-segment-btn ${view === 'week' ? 'review-segment-active' : ''}`}
          onClick={() => setView('week')}
        >
          This Week
        </button>
        <button
          className={`review-segment-btn ${view === 'anchors' ? 'review-segment-active' : ''}`}
          onClick={() => setView('anchors')}
        >
          Anchors
        </button>
      </div>

      {/* Content */}
      {view === 'tonight' && <Night onToast={onToast} />}
      {view === 'week' && <Week key={weekKey} />}
      {view === 'anchors' && <Anchors onSaved={() => onToast('Anchors saved ✓')} />}
    </div>
  )
}
