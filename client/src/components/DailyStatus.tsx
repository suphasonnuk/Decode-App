import { getTodayCache, getNightCache, getAnchors } from '../store'

type AppTab = string

interface Props {
  onTabChange: (t: AppTab) => void
  activeTab: AppTab
  streak?: number | null
}

interface StatusStep {
  key: string
  done: boolean
  icon: string
  color: string
}

export default function DailyStatus({ onTabChange, activeTab, streak }: Props) {
  const day   = getTodayCache()
  const night = getNightCache()
  const anch  = getAnchors()

  const hour = new Date().getHours()

  const anchorsSet    = !!(anch.work || anch.future || anch.body)
  const tasksSelected = !!(day.work_task && day.future_task && day.body_task)
  const tasksDoneCount = [day.work_done, day.future_done, day.body_done].filter(Boolean).length
  const allTasksDone  = tasksDoneCount === 3
  const nightDone     = !!(night.outcome && night.tomorrow_action)
  const todayDone     = tasksSelected && nightDone

  // Progress steps for the dot indicator
  const steps: StatusStep[] = [
    { key: 'anchors', done: anchorsSet,    icon: '🧭', color: 'var(--accent)' },
    { key: 'morning', done: tasksSelected, icon: '☀️', color: 'var(--work)'   },
    { key: 'tasks',   done: allTasksDone,  icon: '✅', color: 'var(--future)' },
    { key: 'night',   done: nightDone,     icon: '🌙', color: 'var(--body)'   },
  ]
  const completedSteps = steps.filter(s => s.done).length

  // Determine the primary action and message
  let icon = '☀️'
  let message: React.ReactNode = ''
  let sub = ''
  let targetTab: AppTab = 'daily'
  let statusClass = 'daily-status-morning'

  if (todayDone) {
    icon = '✅'
    statusClass = 'daily-status-done'
    targetTab = 'week'
    message = <><strong>Day complete</strong> — well done{(streak ?? 0) > 1 ? `, ${streak}-day streak` : ''}</>
    sub = 'View your week'
  } else if (!tasksSelected) {
    if (hour < 5) {
      icon = '😴'
      message = 'Get some rest — log tomorrow morning'
      sub = ''
    } else if (hour < 12) {
      icon = '☀️'
      message = <><strong>Good morning</strong> — pick your 3 tasks</>
      sub = `${3 - tasksDoneCount} tasks to select`
    } else if (hour < 18) {
      icon = '⏰'
      statusClass = 'daily-status-urgent'
      message = <><strong>Afternoon</strong> — you haven't logged today</>
      sub = 'Set your tasks now'
    } else {
      icon = '🚨'
      statusClass = 'daily-status-urgent'
      message = <><strong>Day almost over</strong> — log now before midnight</>
      sub = 'Don\'t break your streak'
    }
  } else if (!allTasksDone) {
    icon = '💪'
    targetTab = 'daily'
    message = <><strong>{tasksDoneCount}/3 tasks done</strong> — keep going</>
    sub = hour >= 18 ? 'Close the day tonight' : 'Mark tasks as you finish them'
  } else if (!nightDone) {
    targetTab = 'night'
    statusClass = 'daily-status-night'
    if (hour >= 22) {
      icon = '🚨'
      statusClass = 'daily-status-urgent'
      message = <><strong>Almost midnight</strong> — close the day NOW</>
      sub = (streak ?? 0) >= 3 ? `${streak}-day streak at risk!` : 'Don\'t miss tonight'
    } else if (hour >= 18) {
      icon = '🌙'
      message = <><strong>All tasks done</strong> — close the day</>
      sub = 'Rate your day and plan tomorrow'
    } else {
      icon = '✓'
      statusClass = 'daily-status-done'
      message = <><strong>All tasks done</strong> — close the day tonight</>
      sub = 'Come back this evening'
    }
  }

  // Don't show empty state
  if (!message) return null

  return (
    <div
      className={`daily-status ${statusClass} ${activeTab === targetTab ? 'daily-status-active' : ''}`}
      onClick={() => onTabChange(targetTab)}
    >
      <span className="ds-icon">{icon}</span>
      <div className="ds-text">
        <div className="ds-message">{message}</div>
        {sub && <div className="ds-sub">{sub}</div>}
      </div>
      <div className="ds-right">
        <div className="ds-dots">
          {steps.map(s => (
            <div
              key={s.key}
              className={`ds-dot ${s.done ? 'ds-dot-done' : ''}`}
              style={s.done ? { background: s.color } : undefined}
              title={s.key}
            />
          ))}
        </div>
        <span className="ds-arrow">→</span>
      </div>
    </div>
  )
}
