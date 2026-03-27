import { useState, useCallback } from 'react'
import { getTodayCache, saveTodayCache } from '../store'
import { hapticLight, hapticSuccess } from '../lib/haptics'
import type { LogPayload } from '../types'

interface Props {
  onToast: (msg: string, err?: boolean) => void
}

const CATEGORIES = [
  { key: 'work_done',   icon: '💼', label: 'Work',   color: 'var(--work)'   },
  { key: 'future_done', icon: '🚀', label: 'Future', color: 'var(--future)' },
  { key: 'body_done',   icon: '💪', label: 'Body',   color: 'var(--body)'   },
] as const

export default function QuickLog({ onToast }: Props) {
  const [open, setOpen] = useState(false)
  const [cache, setCache] = useState<Partial<LogPayload>>(() => getTodayCache())
  const hasTasks = !!(cache.work_task && cache.future_task && cache.body_task)

  // Re-read cache when menu opens (in case Today tab changed it)
  const handleOpen = useCallback(() => {
    setCache(getTodayCache())
    setOpen(o => !o)
    hapticLight()
  }, [])

  if (!hasTasks) return null

  const toggle = (key: string) => {
    const prev = cache[key as keyof typeof cache] as boolean | undefined
    const next = !prev
    const updated = { ...cache, [key]: next }
    saveTodayCache(updated)
    setCache(updated)
    if (next) hapticSuccess()
    else hapticLight()
    onToast(next ? 'Marked done' : 'Unmarked')
  }

  return (
    <>
      {open && <div className="quicklog-backdrop" onClick={() => setOpen(false)} />}
      <div className={`quicklog-menu ${open ? 'quicklog-open' : ''}`}>
        {CATEGORIES.map(c => {
          const isDone = !!(cache[c.key as keyof typeof cache])
          return (
            <button
              key={c.key}
              className={`quicklog-item ${isDone ? 'quicklog-done' : ''}`}
              style={{ '--ql-color': c.color } as React.CSSProperties}
              onClick={() => { toggle(c.key); }}
            >
              <span>{c.icon}</span>
              <span className="quicklog-item-label">{c.label}</span>
              {isDone && <span className="quicklog-check">✓</span>}
            </button>
          )
        })}
      </div>
      <button
        className="quicklog-fab"
        onClick={handleOpen}
        title="Quick log"
      >
        {open ? '✕' : '⚡'}
      </button>
    </>
  )
}
