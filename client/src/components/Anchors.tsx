import { useState, useEffect } from 'react'
import type { WeekAnchors } from '../types'
import { TASK_CATEGORIES } from '../data'
import { getAnchors, saveAnchors, weekStartStr } from '../store'
import { api } from '../api'

interface Props { onSaved: () => void }

export default function Anchors({ onSaved }: Props) {
  const [anchors, setAnchors]   = useState<WeekAnchors>(getAnchors)
  const [syncing, setSyncing]   = useState(true)
  const [syncMsg, setSyncMsg]   = useState('')
  const [saved,   setSaved]     = useState(false)

  const weekLabel = (() => {
    const d = new Date(weekStartStr() + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  })()

  useEffect(() => {
    api.getWeekAnchors()
      .then(bqAnchors => {
        if (bqAnchors && (bqAnchors.work || bqAnchors.future || bqAnchors.body)) {
          const local = getAnchors()
          if (!local.work && !local.future && !local.body) {
            setAnchors(bqAnchors)
            saveAnchors(bqAnchors)
            setSyncMsg('Loaded from cloud — all your devices are in sync')
          }
        }
      })
      .catch(() => {})
      .finally(() => setSyncing(false))
  }, [])

  const update = (key: keyof WeekAnchors) =>
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setAnchors(prev => ({ ...prev, [key]: e.target.value }))
      setSaved(false)
    }

  const handleSave = () => {
    saveAnchors(anchors)
    setSaved(true)
    setSyncMsg('')
    onSaved()
  }

  // Config pulled from data/tasks.ts — change labels/icons/hints there
  const configs = TASK_CATEGORIES.map(cat => ({
    key: cat.key, color: cat.color, label: cat.label, icon: cat.icon, hint: cat.anchor_hint,
  }))

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">Weekly Anchors</div>
        <div className="page-intro-sub">Set every Sunday · Week of {weekLabel}
          {syncing && <span className="sync-spinner" />}
        </div>
      </div>

      {syncMsg && (
        <div className="info-banner">
          <span className="info-banner-icon">☁️</span>
          {syncMsg}
        </div>
      )}

      <div className="tip-box">
        <strong>How to use:</strong> Write one clear intention per category. These stay visible in the WEEK tab all week — they're your compass, not your to-do list.
      </div>

      {configs.map(({ key, color, label, icon, hint }) => (
        <div className="anchor-field" key={key}>
          <div className="anchor-field-header">
            <span className="anchor-field-icon">{icon}</span>
            <span className="anchor-field-label" style={{ color }}>{label}</span>
          </div>
          <textarea
            className="anchor-textarea"
            rows={2}
            value={anchors[key]}
            onChange={update(key)}
            placeholder={hint}
            style={{ borderLeftColor: color }}
          />
        </div>
      ))}

      <button
        className={saved ? 'btn-success' : 'btn-primary'}
        style={{ width: '100%', marginTop: 8 }}
        onClick={handleSave}
      >
        {saved ? '✓ Anchors Saved' : 'Save Anchors'}
      </button>
    </div>
  )
}