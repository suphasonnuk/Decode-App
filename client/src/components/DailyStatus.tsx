import type { Tab } from '../types'
import { getTodayCache, getNightCache } from '../store'

interface Props {
  onTabChange: (t: Tab) => void
  activeTab: Tab
}

export default function DailyStatus({ onTabChange, activeTab }: Props) {
  const day   = getTodayCache()
  const night = getNightCache()

  const tasksDone   = !!(day.work_task && day.future_task && day.body_task)
  const nightDone   = !!(night.outcome)
  const todayDone   = tasksDone && nightDone

  // What should they do right now?
  const hour = new Date().getHours()
  const isEvening = hour >= 18

  if (todayDone) {
    return (
      <div className="daily-status daily-status-done" onClick={() => onTabChange('week')}>
        <span className="ds-icon">✅</span>
        <span className="ds-text">Today is complete — <strong>view your week</strong></span>
        <span className="ds-arrow">→</span>
      </div>
    )
  }

  if (!tasksDone) {
    return (
      <div
        className={`daily-status daily-status-morning ${activeTab === 'daily' ? 'daily-status-active' : ''}`}
        onClick={() => onTabChange('daily')}
      >
        <span className="ds-icon">☀️</span>
        <span className="ds-text">
          {isEvening
            ? <>You haven't logged today yet — <strong>do it now</strong></>
            : <>Start your day — <strong>pick today's 3 tasks</strong></>
          }
        </span>
        <span className="ds-arrow">→</span>
      </div>
    )
  }

  if (!nightDone) {
    return (
      <div
        className={`daily-status daily-status-night ${activeTab === 'night' ? 'daily-status-active' : ''}`}
        onClick={() => onTabChange('night')}
      >
        <span className="ds-icon">🌙</span>
        <span className="ds-text">
          {isEvening
            ? <>Evening — time to <strong>close the day</strong></>
            : <>Tasks logged — close the day tonight</>
          }
        </span>
        <span className="ds-arrow">→</span>
      </div>
    )
  }

  return null
}
