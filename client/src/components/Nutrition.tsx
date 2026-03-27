import { useState, useEffect, useRef } from 'react'
import { api, type NutritionEntry, type NutritionFacts, type NutritionTotals, type HealthImpact } from '../api'
import { getUserId, getProfileCache, calculateNutritionTargets } from '../store'

// Daily targets are calculated from user profile using Mifflin-St Jeor formula.
// Falls back to 2000kcal defaults if profile is incomplete.
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
type Mode = 'log' | 'photo' | 'manual'

// ── MacroBar ──────────────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color, unit = 'g' }: {
  label: string; value: number; target: number; color: string; unit?: string
}) {
  // Guard against division by zero or NaN
  const pct  = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0
  const over = value > target
  return (
    <div className="nutr-macro-row">
      <div className="nutr-macro-label">{label}</div>
      <div className="nutr-macro-bar-wrap">
        <div className="nutr-macro-bar-track">
          <div
            className="nutr-macro-bar-fill"
            style={{ width: `${pct}%`, background: over ? 'var(--miss)' : color }}
          />
        </div>
      </div>
      <div className="nutr-macro-nums" style={{ color: over ? 'var(--miss)' : color }}>
        <span className="nutr-macro-val">{Math.round(value)}</span>
        <span className="nutr-macro-target">/{target}{unit}</span>
      </div>
    </div>
  )
}

// ── MealCard ──────────────────────────────────────────────────────────────────
function MealCard({ entry, onEdit, onDelete }: { entry: NutritionEntry; onEdit?: (e: NutritionEntry) => void; onDelete?: (id: string) => void }) {
  const mealIcon: Record<string, string> = {
    breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎',
  }
  const icon = mealIcon[(entry.meal_type || '').toLowerCase()] ?? '🍽️'
  return (
    <div className="nutr-meal-card">
      <div className="nutr-meal-header">
        <span className="nutr-meal-icon">{icon}</span>
        <div className="nutr-meal-info">
          <div className="nutr-meal-name">{entry.dish_name}</div>
          <div className="nutr-meal-meta">
            {entry.meal_type && <span className="nutr-meal-type">{entry.meal_type}</span>}
            {entry.source === 'ai_image' && <span className="nutr-source-badge">📷 AI scan</span>}
            {entry.source === 'ai_text'  && <span className="nutr-source-badge">🤖 AI estimate</span>}
            {entry.source === 'manual'   && <span className="nutr-source-badge">✏️ Manual</span>}
          </div>
        </div>
        {entry.calories != null && (
          <div className="nutr-meal-cal">{Math.round(entry.calories)}<span>kcal</span></div>
        )}
        {onEdit && (
          <button className="nutr-meal-edit-btn" onClick={() => onEdit(entry)} title="Edit this meal">✏️</button>
        )}
        {onDelete && entry.entry_id && (
          <button className="nutr-meal-delete-btn" onClick={() => onDelete(entry.entry_id!)} title="Remove this meal">🗑️</button>
        )}
      </div>
      {(entry.protein_g != null || entry.carbs_g != null || entry.fat_g != null) && (
        <div className="nutr-meal-macros">
          {entry.protein_g != null && <span style={{ color: 'var(--work)'    }}>P {Math.round(entry.protein_g)}g</span>}
          {entry.carbs_g   != null && <span style={{ color: 'var(--future)'  }}>C {Math.round(entry.carbs_g)}g</span>}
          {entry.fat_g     != null && <span style={{ color: 'var(--partial)' }}>F {Math.round(entry.fat_g)}g</span>}
          {entry.fiber_g   != null && <span style={{ color: 'var(--body)'    }}>Fb {Math.round(entry.fiber_g)}g</span>}
        </div>
      )}
      {/* Health impact — parsed from ai_analysis if available */}
      {entry.health_impact && (
        <div style={{ marginTop: 8 }}>
          <HealthImpactCard impact={entry.health_impact} />
        </div>
      )}
    </div>
  )
}


// ── HealthImpactCard — collapsed by default, tap to expand ───────────────────
function HealthImpactCard({ impact }: { impact: HealthImpact }) {
  const [expanded, setExpanded] = useState(false)
  const ratingConfig = {
    positive: { color: 'var(--win)',     icon: '✅', label: 'Good choice'      },
    neutral:  { color: 'var(--future)',  icon: '⚡', label: 'Moderate'         },
    mixed:    { color: 'var(--partial)', icon: '⚖️', label: 'Mixed'            },
    negative: { color: 'var(--miss)',    icon: '⚠️', label: 'Use with caution' },
  }
  const cfg = ratingConfig[impact.rating] ?? ratingConfig.neutral

  return (
    <div
      className="nutr-impact-card"
      style={{ borderColor: `${cfg.color}30` }}
      onClick={() => setExpanded(p => !p)}
    >
      {/* Always visible — just the rating badge */}
      <div className="nutr-impact-header" style={{ background: `${cfg.color}08` }}>
        <span className="nutr-impact-icon">{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div className="nutr-impact-label" style={{ color: cfg.color }}>
            {cfg.label}
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted2)', paddingRight: 2 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded detail — hidden by default */}
      {expanded && (
        <div className="nutr-impact-body" onClick={e => e.stopPropagation()}>
          <p className="nutr-impact-summary">{impact.summary}</p>
          {impact.highlights && impact.highlights.length > 0 && (
            <div className="nutr-impact-highlights">
              {impact.highlights.map((h, i) => (
                <div key={i} className="nutr-impact-highlight">
                  <span className="nutr-impact-dot" style={{ background: cfg.color }} />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}
          {impact.watch && (
            <div className="nutr-impact-watch">
              <span>⚠️</span>
              <span>{impact.watch}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── NutritionForm ─────────────────────────────────────────────────────────────
// IMPORTANT: always render with a unique key= prop so state resets when initial changes.
interface NutritionFormProps {
  initial: Partial<NutritionFacts & { meal_type: string }>
  source:  string
  onSave:  (entry: Partial<NutritionEntry>) => void
  onCancel:() => void
  saving:  boolean
}

function NutritionForm({ initial, source, onSave, onCancel, saving }: NutritionFormProps) {
  const [form, setForm] = useState({
    dish_name: initial.dish_name  ?? '',
    meal_type: initial.meal_type  ?? '',
    calories:  initial.calories   != null ? String(Math.round(initial.calories))  : '',
    protein_g: initial.protein_g  != null ? String(Math.round(initial.protein_g)) : '',
    carbs_g:   initial.carbs_g    != null ? String(Math.round(initial.carbs_g))   : '',
    fat_g:     initial.fat_g      != null ? String(Math.round(initial.fat_g))     : '',
    fiber_g:   initial.fiber_g    != null ? String(Math.round(initial.fiber_g))   : '',
    sugar_g:   initial.sugar_g    != null ? String(Math.round(initial.sugar_g))   : '',
    sodium_mg: initial.sodium_mg  != null ? String(Math.round(initial.sodium_mg)) : '',
    notes:     '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const num = (v: string) => v.trim() !== '' ? parseFloat(v) : null

  const handleSave = () => {
    if (!form.dish_name.trim()) return
    onSave({
      dish_name: form.dish_name.trim(),
      meal_type: form.meal_type,
      calories:  num(form.calories),
      protein_g: num(form.protein_g),
      carbs_g:   num(form.carbs_g),
      fat_g:     num(form.fat_g),
      fiber_g:   num(form.fiber_g),
      sugar_g:   num(form.sugar_g),
      sodium_mg: num(form.sodium_mg),
      notes:     form.notes.trim() || undefined,
      source,
    })
  }

  const FIELDS = [
    { key: 'calories',  label: 'Calories', unit: 'kcal', color: 'var(--accent)'  },
    { key: 'protein_g', label: 'Protein',  unit: 'g',    color: 'var(--work)'    },
    { key: 'carbs_g',   label: 'Carbs',    unit: 'g',    color: 'var(--future)'  },
    { key: 'fat_g',     label: 'Fat',      unit: 'g',    color: 'var(--partial)' },
    { key: 'fiber_g',   label: 'Fiber',    unit: 'g',    color: 'var(--body)'    },
    { key: 'sugar_g',   label: 'Sugar',    unit: 'g',    color: '#f48fb1'        },
    { key: 'sodium_mg', label: 'Sodium',   unit: 'mg',   color: 'var(--muted2)'  },
  ]

  return (
    <div className="nutr-form">
      <div className="nutr-form-field">
        <label>Dish name *</label>
        <input
          className="prof-input"
          value={form.dish_name}
          onChange={set('dish_name')}
          placeholder="e.g. Pad Thai, Grilled Salmon..."
          autoFocus
        />
      </div>
      <div className="nutr-form-field">
        <label>Meal type</label>
        <select className="prof-select" value={form.meal_type} onChange={set('meal_type')}>
          <option value="">— Select —</option>
          {MEAL_TYPES.map(m => <option key={m} value={m.toLowerCase()}>{m}</option>)}
        </select>
      </div>
      <div className="nutr-form-grid">
        {FIELDS.map(f => (
          <div key={f.key} className="nutr-macro-input">
            <label style={{ color: f.color }}>{f.label}</label>
            <div className="nutr-macro-input-wrap">
              <input
                type="number" min="0" step="1"
                className="prof-input nutr-num-input"
                value={(form as any)[f.key]}
                onChange={set(f.key)}
                placeholder="—"
              />
              <span className="nutr-unit">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="nutr-form-field">
        <label>Notes (optional)</label>
        <textarea
          className="field-textarea" rows={2}
          value={form.notes} onChange={set('notes')}
          placeholder="e.g. large portion, no rice..."
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="btn-primary" style={{ flex: 2 }}
          onClick={handleSave}
          disabled={saving || !form.dish_name.trim()}
        >
          {saving ? <><span className="spinner show" /> Saving...</> : '✓ Log this meal'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onToast: (msg: string, err?: boolean) => void; onTabChange: (tab: string) => void }

export default function Nutrition({ onToast, onTabChange }: Props) {
  const [mode,          setMode]          = useState<Mode>('log')
  const [entries,       setEntries]       = useState<NutritionEntry[]>([])
  const [totals,        setTotals]        = useState<NutritionTotals | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [fetchError,    setFetchError]    = useState('')
  const [analyzing,     setAnalyzing]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<NutritionFacts | null>(null)
  const [analyzeSource, setAnalyzeSource] = useState('ai_image')
  const [analyzeRaw,    setAnalyzeRaw]    = useState('')
  const [imagePreview,  setImagePreview]  = useState<string | null>(null)
  const [dishInput,     setDishInput]     = useState('')
  const [error,         setError]         = useState('')
  // Unique key forces NutritionForm to remount (reset state) each new analysis
  const [formKey,       setFormKey]       = useState(0)
  const [editingEntry,  setEditingEntry]  = useState<NutritionEntry | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const userId  = getUserId()
  const TARGETS         = calculateNutritionTargets(getProfileCache())
  const profileComplete = TARGETS.bmr > 0   // false = missing height/weight/birth_year
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    // Only dismiss for this session — show again next day
    try { return sessionStorage.getItem('nutr_nudge_dismissed') === '1' } catch { return false }
  })
  const dismissNudge = () => {
    try { sessionStorage.setItem('nutr_nudge_dismissed', '1') } catch {}
    setNudgeDismissed(true)
  }

  const fetchToday = () => {
    setFetchError('')
    api.getNutritionToday(userId)
      .then(data => {
        setEntries(data.entries || [])
        // Only set totals if we actually got entries — server now returns null for empty
        setTotals(data.totals ?? null)
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Failed to load'
        setFetchError(msg)
        console.error('[nutrition] fetchToday error:', msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchToday() }, [])

  // ── Image resize — with onerror to prevent infinite hang ───────────────────
  const resizeImage = (dataUrl: string, maxPx = 800): Promise<{ base64: string; mediaType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale   = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas  = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const resized = canvas.toDataURL('image/jpeg', 0.85)
        const [header, base64] = resized.split(',')
        const mediaType = header.match(/data:(.*);/)?.[1] || 'image/jpeg'
        resolve({ base64, mediaType })
      }
      // FIX: onerror prevents infinite hang on HEIC or corrupt images
      img.onerror = () => reject(new Error('Could not load image — try a JPEG or PNG'))
      img.src = dataUrl
    })

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    e.target.value = '' // reset so same file can be picked again

    const reader = new FileReader()
    reader.onerror = () => {
      setError('Could not read file — try another image')
      setAnalyzing(false)
    }
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      setAnalyzing(true)
      setMode('photo')

      try {
        const { base64, mediaType } = await resizeImage(dataUrl)
        const res = await api.analyzeNutrition({ image_base64: base64, image_media_type: mediaType })
        if (res.success) {
          setAnalyzeResult(res.nutrition)
          setAnalyzeSource('ai_image')
          setAnalyzeRaw(JSON.stringify(res.nutrition))
          setFormKey(k => k + 1) // force form reset with new data
        } else {
          setError('Analysis failed — try manual entry')
          setMode('manual')
          setImagePreview(null)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError('Analysis failed: ' + msg)
        console.error('[nutrition] image analyze error:', msg)
        setMode('manual')
        setImagePreview(null)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Text estimate ──────────────────────────────────────────────────────────
  const handleTextAnalyze = async () => {
    if (!dishInput.trim()) return
    setError('')
    setAnalyzing(true)
    setImagePreview(null) // FIX: clear any stale image preview from previous scan
    try {
      const res = await api.analyzeNutrition({ dish_name: dishInput.trim() })
      if (res.success) {
        setAnalyzeResult(res.nutrition)
        setAnalyzeSource('ai_text')
        setAnalyzeRaw(JSON.stringify(res.nutrition))
        setFormKey(k => k + 1) // force form reset with new data
        setMode('photo') // reuse confirm form (no image preview since imagePreview is null)
      } else {
        setError('Could not estimate — fill in manually below')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError('AI estimate failed: ' + msg)
      console.error('[nutrition] text analyze error:', msg)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (partial: Partial<NutritionEntry>) => {
    setSaving(true)
    setError('')
    try {
      const entry: NutritionEntry = {
        user_id:       userId,
        dish_name:     partial.dish_name!,
        meal_type:     partial.meal_type || '',
        calories:      partial.calories  ?? null,
        protein_g:     partial.protein_g ?? null,
        carbs_g:       partial.carbs_g   ?? null,
        fat_g:         partial.fat_g     ?? null,
        fiber_g:       partial.fiber_g   ?? null,
        sugar_g:       partial.sugar_g   ?? null,
        sodium_mg:     partial.sodium_mg ?? null,
        source:        partial.source    || 'manual',
        notes:         partial.notes,
        ai_analysis:   analyzeRaw || undefined,
        // Pass health_impact so meal cards can display it without re-fetching
        health_impact: analyzeResult?.health_impact ?? null,
      }
      const res = await api.logNutrition(entry)
      if (res.success) {
        onToast(`✓ ${entry.dish_name} logged!`)
        setMode('log')
        setAnalyzeResult(null)
        setAnalyzeRaw('')
        setImagePreview(null)
        setDishInput('')
        setError('')
        setLoading(true)
        fetchToday()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError('Save failed: ' + msg)
      console.error('[nutrition] save error:', msg)
    } finally {
      setSaving(false)
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Remove this meal from today\'s log?')) return
    setDeletingId(entryId)
    try {
      await api.deleteNutritionEntry(entryId)
      onToast('Meal removed')
      setLoading(true)
      fetchToday()
    } catch (err) {
      onToast('Failed to remove meal', true)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Edit saved meal ───────────────────────────────────────────────────────
  const handleEditStart = (entry: NutritionEntry) => {
    setEditingEntry(entry)
    setMode('manual')
    setFormKey(k => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEditSave = async (partial: Partial<NutritionEntry>) => {
    if (!editingEntry?.entry_id) return
    setSaving(true)
    setError('')
    try {
      const res = await api.editNutritionEntry(editingEntry.entry_id, {
        ...partial,
        user_id:  getUserId(),
        log_date: editingEntry.log_date,
        source:   editingEntry.source,
      })
      if (res.success) {
        onToast(`✓ ${partial.dish_name} updated!`)
        setEditingEntry(null)
        setMode('log')
        setDishInput('')
        setError('')
        setLoading(true)
        fetchToday()
      }
    } catch (err) {
      setError('Update failed: ' + (err instanceof Error ? err.message : 'Unknown'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setMode('log')
    setAnalyzeResult(null)
    setImagePreview(null)
    setDishInput('')
    setError('')
    setEditingEntry(null)
  }

  const calPct   = totals ? Math.min(Math.round((totals.calories / TARGETS.calories) * 100), 100) : 0
  const calColor = !totals
    ? 'var(--muted2)'
    : totals.calories > TARGETS.calories
      ? 'var(--miss)'
      : totals.calories > TARGETS.calories * 0.8
        ? 'var(--win)'
        : 'var(--work)'

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">Nutrition Tracker</div>
        <div className="page-intro-sub">Log what you eat · AI analyzes images and dishes</div>
      </div>

      {/* ── Profile incomplete nudge ── */}
      {!profileComplete && !nudgeDismissed && (
        <div className="nutr-nudge-banner">
          <div className="nutr-nudge-icon">📋</div>
          <div className="nutr-nudge-body">
            <div className="nutr-nudge-title">Set up your nutrition targets</div>
            <div className="nutr-nudge-desc">
              Your calorie and macro targets are generic (2000 kcal). Fill in your height, weight, age, and exercise level in your profile to get targets calculated specifically for your body using the Mifflin-St Jeor formula.
            </div>
            <button className="nutr-nudge-btn" onClick={() => {
              try {
                sessionStorage.setItem('decode_open_profile', '1')
                sessionStorage.setItem('decode_highlight_body', '1')
              } catch {}
              onTabChange('dashboard')
            }}>
              Go to Profile → set up now
            </button>
          </div>
          <button className="nutr-nudge-close" onClick={dismissNudge}>✕</button>
        </div>
      )}

      {/* ── Main log view ── */}
      {mode === 'log' && (
        <>
          {/* Calorie ring + macros — only when meals exist */}
          <div className="nutr-summary-card card">
            <div className="nutr-summary-top">
              <div className="nutr-cal-ring">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border2)" strokeWidth="7" />
                  {totals && (
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke={calColor} strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${calPct * 2.136} 213.6`}
                      strokeDashoffset="53.4"
                      style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                  )}
                </svg>
                <div className="nutr-cal-inner">
                  <div className="nutr-cal-num" style={{ color: calColor }}>
                    {loading ? '—' : Math.round(totals?.calories ?? 0)}
                  </div>
                  <div className="nutr-cal-label">kcal</div>
                </div>
              </div>
              <div className="nutr-cal-info">
                <div className="nutr-cal-title" style={{ color: calColor }}>
                  {loading
                    ? 'Loading...'
                    : totals
                      ? `${Math.round(totals.calories)} / ${TARGETS.calories} kcal`
                      : `0 / ${TARGETS.calories} kcal`
                  }
                </div>
                <div className="nutr-cal-sub">
                  {totals && totals.calories > TARGETS.calories
                    ? `${Math.round(totals.calories - TARGETS.calories)} kcal over target`
                    : totals
                      ? `${Math.round(TARGETS.calories - totals.calories)} kcal remaining`
                      : profileComplete ? `Target: ${TARGETS.calories} kcal · personalised` : `Target: ${TARGETS.calories} kcal · fill profile to personalise`
                  }
                </div>
                <div className="nutr-meals-count">
                  {entries.length} meal{entries.length !== 1 ? 's' : ''} today
                </div>
              </div>
            </div>

            {/* Macro bars — only shown when at least one meal logged */}
            {totals && entries.length > 0 && (
              <div className="nutr-macros">
                <MacroBar label="Protein" value={totals.protein_g} target={TARGETS.protein_g} color="var(--work)"    />
                <MacroBar label="Carbs"   value={totals.carbs_g}   target={TARGETS.carbs_g}   color="var(--future)"  />
                <MacroBar label="Fat"     value={totals.fat_g}     target={TARGETS.fat_g}     color="var(--partial)" />
                <MacroBar label="Fiber"   value={totals.fiber_g}   target={TARGETS.fiber_g}   color="var(--body)"    />
              </div>
            )}
          </div>

          {/* Add buttons */}
          <div className="nutr-add-row">
            <button className="nutr-add-btn" onClick={() => fileInputRef.current?.click()}>
              <span>📷</span>
              <span>Photo / Image</span>
              <span className="nutr-add-sub">Camera or gallery</span>
            </button>
            <button className="nutr-add-btn" onClick={() => setMode('manual')}>
              <span>✏️</span>
              <span>Manual entry</span>
              <span className="nutr-add-sub">Type dish name</span>
            </button>
          </div>
          <input
            ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleImageSelect}
          />

          {/* Today's meals */}
          {entries.length > 0 && (
            <div className="card">
              <div className="card-label">Today's meals</div>
              {entries.map((e, i) => <MealCard key={e.entry_id ?? i} entry={e} onEdit={handleEditStart} onDelete={handleDelete} />)}
            </div>
          )}

          {/* Empty state */}
          {entries.length === 0 && !loading && !fetchError && (
            <div className="empty-state">
              <div className="empty-state-icon">🍽️</div>
              <div className="empty-state-title">No meals logged yet</div>
              <div className="empty-state-desc">
                Snap a photo of your food or add manually.<br/>Claude will estimate the nutrition facts.
              </div>
            </div>
          )}

          {/* Fetch error */}
          {fetchError && (
            <div className="warning-banner" style={{ marginTop: 8 }}>
              <span>⚠️</span>
              <span>Could not load today's meals: {fetchError}</span>
            </div>
          )}
        </>
      )}

      {/* ── Analyzing spinner ── */}
      {analyzing && (
        <div className="nutr-analyzing">
          <div className="coach-loading-dots"><div /><div /><div /></div>
          <div className="nutr-analyzing-label">Claude is analyzing your food...</div>
          <div className="nutr-analyzing-sub">Estimating calories, protein, carbs, and fat</div>
          {imagePreview && (
            <img src={imagePreview} className="nutr-image-preview" alt="food being analyzed" />
          )}
        </div>
      )}

      {/* ── Confirm form (after photo or text AI analysis) ── */}
      {mode === 'photo' && !analyzing && analyzeResult && (
        <div>
          {imagePreview && (
            <img src={imagePreview} className="nutr-image-preview" alt="analyzed food" />
          )}
          {analyzeResult.confidence && (
            <div className={`nutr-confidence nutr-confidence-${analyzeResult.confidence}`}>
              {analyzeResult.confidence === 'high'   && '✓ High confidence estimate'}
              {analyzeResult.confidence === 'medium' && '⚡ Medium confidence — review the numbers'}
              {analyzeResult.confidence === 'low'    && '⚠️ Low confidence — please verify manually'}
              {analyzeResult.notes && ` · ${analyzeResult.notes}`}
            </div>
          )}
          <div className="card-label" style={{ marginBottom: 12 }}>Review and confirm</div>
          {/* Health impact — shown above the form so user sees it before confirming */}
          {analyzeResult.health_impact && (
            <HealthImpactCard impact={analyzeResult.health_impact} />
          )}
          {/* key=formKey forces full remount when new analysis result arrives */}
          <NutritionForm
            key={formKey}
            initial={analyzeResult}
            source={analyzeSource}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={saving}
          />
        </div>
      )}

      {/* ── Manual entry mode ── */}
      {mode === 'manual' && !analyzing && (
        <div>
          {/* Edit mode banner */}
          {editingEntry && (
            <div className="nutr-edit-banner">
              <span>✏️</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text)' }}>Editing: {editingEntry.dish_name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>Change anything below and save to update in BigQuery</div>
              </div>
              <button className="nutr-nudge-close" onClick={handleCancel}>✕</button>
            </div>
          )}

          {!editingEntry && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="card-label">AI estimate from dish name</div>
              <div className="nutr-text-analyze">
                <input
                  className="prof-input"
                  value={dishInput}
                  onChange={e => setDishInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTextAnalyze()}
                  placeholder='e.g. "Tom Yum soup" or "Big Mac meal"...'
                  autoFocus
                />
                <button
                  className="btn-primary nutr-analyze-btn"
                  onClick={handleTextAnalyze}
                  disabled={!dishInput.trim() || analyzing}
                >
                  🤖 Estimate
                </button>
              </div>
              <div className="nutr-or-divider">— or fill in manually below —</div>
            </div>
          )}

          {/* key=formKey ensures form resets if user types new dish after AI estimate */}
          <NutritionForm
            key={`manual-${formKey}`}
            initial={editingEntry ? {
              dish_name: editingEntry.dish_name,
              meal_type: editingEntry.meal_type,
              calories:  editingEntry.calories,
              protein_g: editingEntry.protein_g,
              carbs_g:   editingEntry.carbs_g,
              fat_g:     editingEntry.fat_g,
              fiber_g:   editingEntry.fiber_g,
              sugar_g:   editingEntry.sugar_g,
              sodium_mg: editingEntry.sodium_mg,
            } : { dish_name: dishInput }}
            source={editingEntry ? editingEntry.source : "manual"}
            onSave={editingEntry ? handleEditSave : handleSave}
            onCancel={handleCancel}
            saving={saving}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="warning-banner" style={{ marginTop: 12 }}>
          <span>⚠️</span><span>{error}</span>
        </div>
      )}
    </div>
  )
}