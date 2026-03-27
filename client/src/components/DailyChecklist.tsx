import type { Tab } from '../types'
import type { TimePeriod } from '../data/calendar'
import { getTimePeriod, TIME_PERIOD_LABELS } from '../data/calendar'
import { getTodayCache, getNightCache, getAnchors } from '../store'

interface Props {
  onClose: () => void
  onGoTo: (tab: Tab) => void
}

// ── Status snapshot ───────────────────────────────────────────────────────────
function getDailyStatus() {
  const now   = new Date()
  const hour  = now.getHours()
  const dow   = new Date().getDay()
  const period= getTimePeriod(hour)

  const day   = getTodayCache()
  const night = getNightCache()
  const anch  = getAnchors()

  const anchorsSet     = !!(anch.work || anch.future || anch.body)
  const tasksSelected  = !!(day.work_task && day.future_task && day.body_task)
  const allTasksDone   = !!(day.work_done && day.future_done && day.body_done)
  const someTasksDone  = !!(day.work_done || day.future_done || day.body_done)
  const nightComplete  = !!(night.outcome && night.tomorrow_action)

  const isSunday    = dow === 0
  const isMorning   = period === 'early_morning' || period === 'morning'
  const isAfternoon = period === 'afternoon'
  const isEvening   = period === 'evening'
  const isLateNight = period === 'late_night'
  const isNightTime = isEvening || isLateNight

  return {
    hour, period, dow,
    isSunday, isMorning, isAfternoon, isEvening, isLateNight, isNightTime,
    anchorsSet, tasksSelected, allTasksDone, someTasksDone, nightComplete,
  }
}

// ── Urgency levels ────────────────────────────────────────────────────────────
type Urgency = 'none' | 'chill' | 'normal' | 'urgent' | 'overdue'

// ── Build checklist items ─────────────────────────────────────────────────────
function buildChecklist(s: ReturnType<typeof getDailyStatus>) {
  const items: {
    id: string
    done: boolean
    tab: Tab
    icon: string
    title: string
    detail: string
    when: string
    color: string
    urgency: Urgency
    badge: string | null   // text shown in the badge pill
    muted: boolean         // grayed out — not relevant yet
  }[] = []

  // ── 1. WEEKLY ANCHORS (Sunday only, or if never set) ────────────────────────
  const showAnchors = s.isSunday || !s.anchorsSet
  if (showAnchors) {
    let urgency: Urgency = 'none'
    let badge: string | null = null
    let when = 'Sunday · 5 min'

    if (!s.anchorsSet) {
      if (s.isSunday) {
        // On Sunday: escalate through the day
        if (s.period === 'early_morning') { urgency = 'chill';  badge = 'Today';  when = 'Do this today — Sunday' }
        else if (s.period === 'morning')  { urgency = 'normal'; badge = 'Do now'; when = 'Good time — Sunday morning' }
        else if (s.period === 'afternoon'){ urgency = 'urgent'; badge = 'Now';    when = 'Sunday afternoon — do it before evening' }
        else                              { urgency = 'overdue';badge = 'Overdue';when = 'Sunday is almost over!' }
      } else {
        // Not Sunday but anchors missing — mild reminder all week
        urgency = 'normal'
        badge = 'Missing'
        when = 'Should be set on Sunday'
      }
    } else {
      urgency = 'none'
      badge = null
      when = 'Set this week ✓'
    }

    items.push({
      id: 'anchors', done: s.anchorsSet, tab: 'anchors',
      icon: '🧭', color: 'var(--accent)',
      title: s.anchorsSet ? 'Weekly anchors set' : 'Set weekly anchors',
      detail: s.anchorsSet
        ? `Work, future & body goals are set for this week.`
        : `One goal each for work, future, and body — your compass all week.`,
      when, urgency, badge, muted: false,
    })
  }

  // ── 2. MORNING TASKS (Today tab) ────────────────────────────────────────────
  let taskUrgency: Urgency = 'none'
  let taskBadge: string | null = null
  let taskWhen = 'Every morning · 3 min'
  let taskTitle = s.tasksSelected ? `Today's tasks logged` : `Pick today's 3 tasks`
  let taskDetail = ''
  let taskMuted = false

  if (!s.tasksSelected) {
    if (s.period === 'early_morning') {
      // 5–9am: chill, just woke up, no rush
      taskUrgency = 'chill'
      taskBadge   = 'Morning'
      taskWhen    = 'When you\'re ready — no rush yet'
      taskDetail  = 'Start your day by picking one task each for work, future, and body.'
    } else if (s.period === 'morning') {
      // 9–12pm: this is the right time, do it now
      taskUrgency = 'normal'
      taskBadge   = 'Do now'
      taskWhen    = 'Good time — morning is here'
      taskDetail  = 'Pick one task each: work, future, body. Set energy slider. Takes 3 min.'
    } else if (s.period === 'afternoon') {
      // 12–6pm: getting late for morning log
      taskUrgency = 'urgent'
      taskBadge   = 'Late'
      taskWhen    = 'Afternoon — log it now before evening'
      taskDetail  = 'You haven\'t logged today yet. Better late than never — takes 3 min.'
    } else {
      // Evening / late night: still not done
      taskUrgency = 'overdue'
      taskBadge   = 'Overdue'
      taskWhen    = 'You missed the morning — still worth logging'
      taskDetail  = 'Log your tasks now so the night save has something to work with.'
    }
  } else {
    // Tasks selected — show completion state
    taskDetail = s.allTasksDone
      ? 'All 3 tasks completed today ✓'
      : s.someTasksDone
        ? 'Some tasks done. Come back to tick the rest as you finish.'
        : 'Tasks selected. Tick "Mark done" on each task as you complete them.'
    taskWhen = s.allTasksDone ? 'All done ✓' : 'Mark tasks done during the day'
  }

  items.push({
    id: 'tasks', done: s.tasksSelected, tab: 'daily',
    icon: '☀️', color: 'var(--work)',
    title: taskTitle, detail: taskDetail,
    when: taskWhen, urgency: taskUrgency,
    badge: taskBadge, muted: false,
  })

  // ── 3. NIGHT / CLOSE THE DAY ────────────────────────────────────────────────
  let nightUrgency: Urgency = 'none'
  let nightBadge: string | null = null
  let nightWhen = 'Every evening · 5 min'
  let nightTitle = s.nightComplete ? 'Day closed' : 'Close the day'
  let nightDetail = ''
  let nightMuted = false

  if (!s.nightComplete) {
    if (s.period === 'early_morning' || s.period === 'morning') {
      // Before noon: night task is not relevant yet — show as future/muted
      nightUrgency = 'none'
      nightBadge   = 'Tonight'
      nightWhen    = 'Come back this evening'
      nightDetail  = 'After your day is done, come back here to rate the day and plan tomorrow.'
      nightMuted   = true   // grayed out — not time yet
    } else if (s.period === 'afternoon') {
      // 12–6pm: not yet urgent, but show it clearly
      nightUrgency = 'chill'
      nightBadge   = 'Later'
      nightWhen    = 'Do this in the evening'
      nightDetail  = 'Rate WIN / PARTIAL / MISS, score focus & mood, write tomorrow\'s first action.'
      nightMuted   = false
    } else if (s.period === 'evening') {
      // 6–10pm: right time — normal urgency
      nightUrgency = s.tasksSelected ? 'normal' : 'chill'
      nightBadge   = 'Now'
      nightWhen    = 'Evening — perfect time to close the day'
      nightDetail  = 'Rate the day, score focus & mood, write tomorrow\'s first action.'
      nightMuted   = false
    } else {
      // 10pm+: late — urgent if tasks done, still urgent if not
      nightUrgency = 'urgent'
      nightBadge   = 'Late'
      nightWhen    = 'Getting late — do this before you sleep'
      nightDetail  = 'Rate WIN / PARTIAL / MISS, write tomorrow\'s plan. Takes 3 min.'
      nightMuted   = false
    }
  } else {
    nightDetail = 'Outcome, focus, mood saved. Tomorrow\'s plan is written. ✓'
    nightWhen   = 'Done ✓'
  }

  // Only show night as muted (future) if it's explicitly muted and tasks not done
  // If tasks not selected and it's morning, night is just "later"
  items.push({
    id: 'night', done: s.nightComplete, tab: 'night',
    icon: '🌙', color: 'var(--body)',
    title: nightTitle, detail: nightDetail,
    when: nightWhen, urgency: nightUrgency,
    badge: nightBadge, muted: nightMuted,
  })

  return items
}

// ── Progress (only count non-muted, relevant items) ───────────────────────────
function getProgress(items: ReturnType<typeof buildChecklist>) {
  const relevant = items.filter(i => !i.muted)
  const done     = relevant.filter(i => i.done).length
  const total    = relevant.length
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0
  return { done, total, pct }
}

// ── Header message — smart based on time + state ──────────────────────────────
function getHeaderMessage(s: ReturnType<typeof getDailyStatus>, pct: number) {
  if (pct === 100) {
    return { emoji: '✅', title: 'You\'re all done today!', sub: 'Nothing more to do. Check the Week tab to see your progress.' }
  }

  const { period, isSunday, tasksSelected, nightComplete, anchorsSet } = s

  // Sunday-specific
  if (isSunday && !anchorsSet) {
    if (period === 'early_morning') return { emoji: '🧭', title: 'Happy Sunday', sub: 'When you\'re ready, set your anchors for the week. No rush yet.' }
    if (period === 'morning')       return { emoji: '🧭', title: 'Set your anchors today', sub: 'It\'s Sunday morning — perfect time to set your 3 weekly goals.' }
    if (period === 'afternoon')     return { emoji: '⚠️', title: 'Set anchors before tonight', sub: 'Sunday afternoon — set your weekly goals before the day ends.' }
    if (period === 'evening')       return { emoji: '🚨', title: 'Sunday is almost over', sub: 'Set your weekly anchors now before tomorrow starts without a compass.' }
  }

  // Time-based messages
  if (period === 'early_morning' && !tasksSelected) {
    return { emoji: '☕', title: 'Good morning!', sub: 'When you\'re ready, pick today\'s 3 tasks. No rush — morning is just starting.' }
  }
  if (period === 'morning' && !tasksSelected) {
    return { emoji: '☀️', title: 'Morning is here', sub: 'Time to pick today\'s 3 tasks. Takes 3 minutes.' }
  }
  if (period === 'afternoon' && !tasksSelected) {
    return { emoji: '⚡', title: 'Haven\'t logged today yet', sub: 'Afternoon — log your tasks now so you can close the day tonight.' }
  }
  if (tasksSelected && !nightComplete) {
    if (period === 'morning' || period === 'early_morning') {
      return { emoji: '⚡', title: 'Morning done', sub: 'Tasks saved. Come back this evening to close the day.' }
    }
    if (period === 'afternoon') {
      return { emoji: '🌤', title: 'Tasks logged', sub: 'Come back this evening (after 6pm) to close the day.' }
    }
    if (period === 'evening') {
      return { emoji: '🌙', title: 'Time to close the day', sub: 'Evening is here. Rate the day and write tomorrow\'s plan.' }
    }
    if (period === 'late_night') {
      return { emoji: '⚠️', title: 'Close the day before you sleep', sub: 'Getting late — takes 3 minutes. Rate the day and plan tomorrow.' }
    }
  }
  if (!tasksSelected && period === 'late_night') {
    return { emoji: '😅', title: 'Late check-in', sub: 'You can still log today and close the day. Better late than never.' }
  }

  return { emoji: '🦞', title: 'Here\'s your checklist', sub: 'Complete the tasks below to finish your day.' }
}

// ── Urgency styles ────────────────────────────────────────────────────────────
const URGENCY_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  chill:   { bg: 'oklch(72% 0.12 220 / 0.12)',  color: 'var(--work)'    },
  normal:  { bg: 'oklch(82% 0.14 85 / 0.15)',   color: 'var(--accent)'  },
  urgent:  { bg: 'oklch(76% 0.14 60 / 0.2)',    color: 'var(--partial)' },
  overdue: { bg: 'oklch(62% 0.20 25 / 0.18)',   color: 'var(--miss)'    },
  none:    { bg: 'oklch(95% 0.008 75 / 0.06)',  color: 'var(--muted2)'  },
  Tonight: { bg: 'oklch(76% 0.12 150 / 0.1)',   color: 'var(--body)'    },
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DailyChecklist({ onClose, onGoTo }: Props) {
  const status   = getDailyStatus()
  const items    = buildChecklist(status)
  const progress = getProgress(items)
  const message  = getHeaderMessage(status, progress.pct)

  const progressColor =
    progress.pct === 100 ? 'var(--win)'     :
    progress.pct >= 66   ? 'var(--future)'  :
    progress.pct >= 33   ? 'var(--work)'    :
                           'var(--partial)'

  const handleAction = (tab: Tab, muted: boolean, done: boolean) => {
    if (done) return
    if (muted) return   // not time yet — don't navigate
    onGoTo(tab)
    onClose()
  }

  // Time context string shown at bottom
  const now  = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dayStr  = now.toLocaleDateString('en-US', { weekday: 'long' })
  const periodLabel = TIME_PERIOD_LABELS

  return (
    <div className="checklist-overlay" onClick={onClose}>
      <div className="checklist-sheet" onClick={e => e.stopPropagation()}>

        <div className="checklist-handle" />

        {/* Time context badge */}
        <div className="checklist-time-context">
          <span className="checklist-time-dot" />
          <span>{dayStr} · {timeStr} · {periodLabel[status.period]}</span>
        </div>

        {/* Header */}
        <div className="checklist-header">
          <div className="checklist-status-emoji">{message.emoji}</div>
          <div>
            <div className="checklist-status-title">{message.title}</div>
            <div className="checklist-status-sub">{message.sub}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="checklist-progress-wrap">
          <div className="checklist-progress-track">
            <div
              className="checklist-progress-fill"
              style={{ width: `${progress.pct}%`, background: progressColor }}
            />
          </div>
          <div className="checklist-progress-label" style={{ color: progressColor }}>
            {progress.pct === 100
              ? 'All done today 🎉'
              : `${progress.done} of ${progress.total} done`
            }
          </div>
        </div>

        {/* Section label */}
        <div className="checklist-section-label">Today's workflow</div>

        {/* Items */}
        <div className="checklist-items">
          {items.map(item => {
            const badgeStyle = URGENCY_BADGE_STYLE[item.urgency] ?? URGENCY_BADGE_STYLE.none
            const isClickable = !item.done && !item.muted

            return (
              <div
                key={item.id}
                className={[
                  'checklist-item',
                  item.done    ? 'checklist-item-done'    : '',
                  item.muted   ? 'checklist-item-muted'   : '',
                  item.urgency === 'urgent'  ? 'checklist-item-urgent'  : '',
                  item.urgency === 'overdue' ? 'checklist-item-overdue' : '',
                  isClickable  ? 'checklist-item-clickable' : '',
                ].join(' ')}
                onClick={() => handleAction(item.tab, item.muted, item.done)}
              >
                {/* Checkbox */}
                <div className="checklist-item-left">
                  <div
                    className={`checklist-check ${item.done ? 'checklist-check-done' : ''}`}
                    style={{
                      borderColor:  item.done ? item.color : item.muted ? 'var(--border)' : undefined,
                      background:   item.done ? item.color : undefined,
                    }}
                  >
                    {item.done && <span>✓</span>}
                  </div>
                </div>

                {/* Content */}
                <div className="checklist-item-body">
                  <div className="checklist-item-top">
                    <span className="checklist-item-icon" style={{ opacity: item.muted ? 0.4 : 1 }}>
                      {item.icon}
                    </span>
                    <span
                      className="checklist-item-title"
                      style={{
                        color:          item.done ? 'var(--muted2)' : item.muted ? 'var(--muted2)' : 'var(--text)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        opacity:        item.muted ? 0.5 : 1,
                      }}
                    >
                      {item.title}
                    </span>
                    {/* Badge — show only if not done */}
                    {!item.done && item.badge && (
                      <span
                        className={`checklist-badge ${item.urgency === 'urgent' || item.urgency === 'overdue' ? 'checklist-badge-pulse' : ''}`}
                        style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <div className="checklist-item-detail" style={{ opacity: item.muted ? 0.45 : 1 }}>
                    {item.detail}
                  </div>

                  <div className="checklist-item-when">
                    {item.muted
                      ? '💤 Not time yet — check back later'
                      : item.when
                    }
                  </div>
                </div>

                {/* Arrow — only for clickable incomplete items */}
                {isClickable && (
                  <div className="checklist-item-arrow" style={{ color: item.color }}>→</div>
                )}
                {item.muted && !item.done && (
                  <div className="checklist-item-arrow" style={{ color: 'var(--muted)', fontSize: 13 }}>🔒</div>
                )}
              </div>
            )
          })}
        </div>

        {/* All done — show week button */}
        {progress.pct === 100 && (
          <button className="checklist-week-btn" onClick={() => { onGoTo('week'); onClose() }}>
            📅 View this week's progress
          </button>
        )}

        <button className="checklist-dismiss" onClick={onClose}>
          Got it, dismiss
        </button>

      </div>
    </div>
  )
}