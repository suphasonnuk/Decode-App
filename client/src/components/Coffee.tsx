import { useState, useEffect } from 'react'
import { api } from '../api'
import { getUserId } from '../store'

// ── SCA-based coffee recipes calibrated by roast ──────────────────────────────
// Sources:
//   SCA Golden Cup Standard — 55g/L extraction ratio, 90–96°C
//   World Barista Championship espresso parameters (2024)
//   Hoffmann, J. — The World Atlas of Coffee (2014)

type Roast = 'light' | 'medium' | 'dark'

interface Recipe {
  dose_g:       number
  yield_g:      number
  ratio:        string
  grind:        string
  temp_c:       number
  time_s:       string
  notes:        string
}

interface CoffeeType {
  id:           string
  name:         string
  icon:         string
  tagline:      string
  color:        string
  base:         'espresso' | 'filter'
  getRecipe:    (roast: Roast) => Recipe
  getMethod:    (roast: Roast, recipe: Recipe) => string[]
}

const ROAST_TEMP: Record<Roast, number> = { light: 94, medium: 93, dark: 91 }
const ROAST_TIME: Record<Roast, string> = { light: '28–33s', medium: '25–30s', dark: '22–26s' }
const ROAST_DOSE: Record<Roast, number> = { light: 19, medium: 18, dark: 17 }

const COFFEE_TYPES: CoffeeType[] = [
  {
    id: 'espresso', name: 'Espresso', icon: '☕', color: '#ffb74d',
    tagline: 'Pure. Concentrated. The foundation.',
    base: 'espresso',
    getRecipe: (roast) => ({
      dose_g: ROAST_DOSE[roast],
      yield_g: ROAST_DOSE[roast] * 2,
      ratio: '1:2',
      grind: 'Fine — like table salt',
      temp_c: ROAST_TEMP[roast],
      time_s: ROAST_TIME[roast],
      notes: roast === 'light' ? 'Light roasts need higher temp + longer time to fully extract the bright acids'
           : roast === 'dark'  ? 'Dark roasts extract fast — stop early to avoid bitter over-extraction'
           : 'Medium roasts are the most forgiving — aim for the sweet spot',
    }),
    getMethod: (roast, r) => [
      `Grind ${r.dose_g}g of beans — fine, like table salt`,
      `Distribute evenly in portafilter, tamp firmly with 15–20kg pressure`,
      `Flush group head 2–3 seconds to stabilise temperature at ${r.temp_c}°C`,
      `Lock in portafilter, start extraction immediately`,
      `Target: ${r.yield_g}g out in ${r.time_s} — stop at ${r.yield_g}g`,
      roast === 'light' ? 'Expect bright, fruity, tea-like flavour with light crema'
      : roast === 'dark' ? 'Expect dark chocolate, smoky notes with rich thick crema'
      : 'Expect balanced caramel sweetness with classic golden crema',
    ],
  },
  {
    id: 'americano', name: 'Americano', icon: '🖤', color: '#4fc3f7',
    tagline: 'Espresso strength, filter coffee volume.',
    base: 'espresso',
    getRecipe: (roast) => ({
      dose_g: ROAST_DOSE[roast],
      yield_g: ROAST_DOSE[roast] * 2,
      ratio: '1:2 espresso + 120ml water',
      grind: 'Fine — like table salt',
      temp_c: ROAST_TEMP[roast],
      time_s: ROAST_TIME[roast],
      notes: 'Add water to cup first, then espresso — preserves crema on top',
    }),
    getMethod: (roast, r) => [
      `Pull espresso: ${r.dose_g}g in → ${r.yield_g}g out in ${r.time_s} at ${r.temp_c}°C`,
      `Pour 120ml hot water (off-boil, ~96°C) into your cup first`,
      `Pour espresso over the water — crema floats on top`,
      `Adjust water: 100ml for stronger, 150ml for lighter`,
      'Do not stir — let the espresso layers blend naturally',
    ],
  },
  {
    id: 'latte', name: 'Latte', icon: '🥛', color: '#a5d6a7',
    tagline: 'Silky microfoam. The everyday essential.',
    base: 'espresso',
    getRecipe: (roast) => ({
      dose_g: ROAST_DOSE[roast],
      yield_g: ROAST_DOSE[roast] * 2,
      ratio: '1:2 espresso + 160ml milk',
      grind: 'Fine — like table salt',
      temp_c: ROAST_TEMP[roast],
      time_s: ROAST_TIME[roast],
      notes: 'Milk at 65°C — any hotter kills sweetness. Full-fat gives best microfoam texture.',
    }),
    getMethod: (roast, r) => [
      `Pull espresso: ${r.dose_g}g in → ${r.yield_g}g out in ${r.time_s} at ${r.temp_c}°C`,
      'Steam 200ml whole milk to 65°C — submerge tip just below surface, swirl',
      'Aim for glossy, paint-like microfoam — no large bubbles',
      'Tap milk jug on counter, swirl to integrate foam',
      `Pour milk from low, tilt cup 30° — slow pour for latte art or just silky texture`,
      'Result: ~240ml drink, espresso-to-milk ratio 1:4.5',
    ],
  },
  {
    id: 'flat_white', name: 'Flat White', icon: '🤍', color: '#ce93d8',
    tagline: 'Ristretto base. Stronger, tighter, richer.',
    base: 'espresso',
    getRecipe: (roast) => ({
      dose_g: ROAST_DOSE[roast],
      yield_g: Math.round(ROAST_DOSE[roast] * 1.5),  // ristretto — shorter pull
      ratio: '1:1.5 ristretto + 100ml milk',
      grind: 'Fine-medium — slightly coarser than espresso',
      temp_c: ROAST_TEMP[roast] + 1,  // ristretto needs slightly higher temp
      time_s: ROAST_TIME[roast],
      notes: 'Ristretto stops early — sweeter, more concentrated, less bitter than full espresso',
    }),
    getMethod: (roast, r) => [
      `Pull ristretto: ${r.dose_g}g in → ${r.yield_g}g out (stop early) in ${r.time_s}`,
      `Temperature: ${r.temp_c}°C — slightly higher to compensate for shorter extraction`,
      'Steam 120ml whole milk to 60–65°C — tighter, velvety microfoam',
      'Less foam than latte — aim for 3–4mm foam layer only',
      'Pour over ristretto in a 160ml cup — strong espresso flavour cuts through milk',
    ],
  },
  {
    id: 'cappuccino', name: 'Cappuccino', icon: '💫', color: '#ffd54f',
    tagline: 'Equal thirds. The Italian original.',
    base: 'espresso',
    getRecipe: (roast) => ({
      dose_g: ROAST_DOSE[roast],
      yield_g: ROAST_DOSE[roast] * 2,
      ratio: '1:1:1 — espresso : milk : foam',
      grind: 'Fine — like table salt',
      temp_c: ROAST_TEMP[roast],
      time_s: ROAST_TIME[roast],
      notes: 'Classic Italian: 60ml espresso + 60ml steamed milk + 60ml foam in a 180ml cup',
    }),
    getMethod: (roast, r) => [
      `Pull espresso: ${r.dose_g}g in → ${r.yield_g}g out (~60ml) in ${r.time_s} at ${r.temp_c}°C`,
      'Steam 150ml whole milk — more air than latte, aim for thick glossy foam',
      'Temperature 60–65°C — stop steaming earlier to keep more foam',
      'Pour 60ml steamed milk, then spoon 60ml foam on top',
      'Classic 180ml drink — one-third each of espresso, milk, foam',
      'Optional: dust with cocoa powder through a stencil',
    ],
  },
]

const ROAST_OPTIONS = [
  { id: 'light',  label: 'Light Roast',  desc: 'Fruity · Bright · Tea-like',       color: '#ffcc80' },
  { id: 'medium', label: 'Medium Roast', desc: 'Balanced · Caramel · Classic',     color: '#ff8a65' },
  { id: 'dark',   label: 'Dark Roast',   desc: 'Bold · Chocolate · Smoky',         color: '#5d4037' },
] as const

interface CoffeeLog {
  entry_id:    string
  log_date:    string
  logged_at:   string
  coffee_type: string
  roast:       string
  dose_g:      number | null
  yield_g:     number | null
}

interface Props { onToast: (msg: string, err?: boolean) => void }

export default function Coffee({ onToast }: Props) {
  const [roast,       setRoast]       = useState<Roast>('medium')
  const [selected,    setSelected]    = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [todayLogs,   setTodayLogs]   = useState<CoffeeLog[]>([])
  const [loading,     setLoading]     = useState(true)

  const userId = getUserId()

  useEffect(() => {
    api.getCoffeeToday(userId)
      .then(data => setTodayLogs(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedType = COFFEE_TYPES.find(t => t.id === selected)
  const recipe = selectedType ? selectedType.getRecipe(roast) : null
  const method = selectedType && recipe ? selectedType.getMethod(roast, recipe) : []

  const handleLog = async () => {
    if (!selected || !recipe) return
    setSaving(true)
    try {
      const res = await api.logCoffee({
        user_id:     userId,
        coffee_type: selected,
        roast,
        dose_g:      recipe.dose_g,
        yield_g:     recipe.yield_g,
      })
      if (res.success) {
        onToast(`☕ ${selectedType!.name} logged!`)
        setSelected(null)
        // Refresh today's log
        api.getCoffeeToday(userId).then(d => setTodayLogs(d || [])).catch(() => {})
      }
    } catch (err) {
      onToast('Failed to save coffee log', true)
    } finally {
      setSaving(false)
    }
  }

  const coffeeIcon: Record<string, string> = {
    espresso: '☕', americano: '🖤', latte: '🥛', flat_white: '🤍', cappuccino: '💫',
  }
  const roastLabel: Record<string, string> = { light: 'Light', medium: 'Medium', dark: 'Dark' }

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">Coffee</div>
        <div className="page-intro-sub">SCA-calibrated recipes · personalised by roast</div>
      </div>

      {/* ── Roast selector ── */}
      <div className="coffee-roast-section">
        <div className="card-label">Your beans today</div>
        <div className="coffee-roast-row">
          {ROAST_OPTIONS.map(r => (
            <button
              key={r.id}
              className={`coffee-roast-btn ${roast === r.id ? 'coffee-roast-active' : ''}`}
              style={{ '--roast-color': r.color } as React.CSSProperties}
              onClick={() => setRoast(r.id as Roast)}
            >
              <div className="coffee-roast-swatch" style={{ background: r.color }} />
              <div>
                <div className="coffee-roast-name">{r.label}</div>
                <div className="coffee-roast-desc">{r.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Coffee type grid ── */}
      <div className="card-label" style={{ marginBottom: 10 }}>What are you making?</div>
      <div className="coffee-type-grid">
        {COFFEE_TYPES.map(t => (
          <button
            key={t.id}
            className={`coffee-type-card ${selected === t.id ? 'coffee-type-active' : ''}`}
            style={{ '--coffee-color': t.color } as React.CSSProperties}
            onClick={() => setSelected(selected === t.id ? null : t.id)}
          >
            <div className="coffee-type-icon">{t.icon}</div>
            <div className="coffee-type-name">{t.name}</div>
            <div className="coffee-type-tagline">{t.tagline}</div>
          </button>
        ))}
      </div>

      {/* ── Recipe card ── */}
      {selected && recipe && selectedType && (
        <div className="coffee-recipe-card" style={{ borderColor: `${selectedType.color}40` }}>

          {/* Recipe header */}
          <div className="coffee-recipe-header" style={{ background: `${selectedType.color}10` }}>
            <div className="coffee-recipe-title-row">
              <span style={{ fontSize: 22 }}>{selectedType.icon}</span>
              <div>
                <div className="coffee-recipe-title" style={{ color: selectedType.color }}>
                  {selectedType.name}
                </div>
                <div className="coffee-recipe-roast">
                  {roastLabel[roast]} roast · {recipe.temp_c}°C
                </div>
              </div>
            </div>

            {/* Key numbers */}
            <div className="coffee-recipe-stats">
              <div className="coffee-recipe-stat">
                <div className="coffee-recipe-stat-val" style={{ color: selectedType.color }}>
                  {recipe.dose_g}g
                </div>
                <div className="coffee-recipe-stat-label">beans</div>
              </div>
              <div className="coffee-recipe-stat-divider">→</div>
              <div className="coffee-recipe-stat">
                <div className="coffee-recipe-stat-val" style={{ color: selectedType.color }}>
                  {recipe.yield_g}g
                </div>
                <div className="coffee-recipe-stat-label">yield</div>
              </div>
              <div className="coffee-recipe-stat-divider">·</div>
              <div className="coffee-recipe-stat">
                <div className="coffee-recipe-stat-val" style={{ color: selectedType.color }}>
                  {recipe.time_s}
                </div>
                <div className="coffee-recipe-stat-label">time</div>
              </div>
              <div className="coffee-recipe-stat-divider">·</div>
              <div className="coffee-recipe-stat">
                <div className="coffee-recipe-stat-val" style={{ color: selectedType.color }}>
                  {recipe.ratio}
                </div>
                <div className="coffee-recipe-stat-label">ratio</div>
              </div>
            </div>
          </div>

          {/* Step by step method */}
          <div className="coffee-method">
            <div className="coffee-method-label">Method</div>
            {method.map((step, i) => (
              <div key={i} className="coffee-step">
                <div className="coffee-step-num" style={{ color: selectedType.color }}>{i + 1}</div>
                <div className="coffee-step-text">{step}</div>
              </div>
            ))}
          </div>

          {/* Grind + note */}
          <div className="coffee-notes-row">
            <div className="coffee-note-chip">
              <span>⚙️</span>
              <span>Grind: {recipe.grind}</span>
            </div>
          </div>
          <div className="coffee-science-note">{recipe.notes}</div>

          {/* Log button */}
          <button
            className="btn-primary"
            style={{ marginTop: 14 }}
            onClick={handleLog}
            disabled={saving}
          >
            {saving ? <><span className="spinner show" /> Saving...</> : `☕ Log this ${selectedType.name}`}
          </button>
        </div>
      )}

      {/* ── Today's coffees ── */}
      {todayLogs.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-label">Today's coffees</div>
          {todayLogs.map((log, i) => (
            <div key={log.entry_id ?? i} className="coffee-log-row">
              <span className="coffee-log-icon">
                {coffeeIcon[log.coffee_type] ?? '☕'}
              </span>
              <div className="coffee-log-body">
                <div className="coffee-log-name" style={{ textTransform: 'capitalize' }}>
                  {log.coffee_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="coffee-log-meta">
                  {roastLabel[log.roast] ?? log.roast} roast
                  {log.dose_g ? ` · ${log.dose_g}g` : ''}
                  {log.yield_g ? ` → ${log.yield_g}g` : ''}
                </div>
              </div>
              <div className="coffee-log-time">
                {(() => { const ts = (log.logged_at as any)?.value ?? log.logged_at; const d = new Date(ts); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {todayLogs.length === 0 && !loading && !selected && (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <div className="empty-state-icon">☕</div>
          <div className="empty-state-title">No coffee yet today</div>
          <div className="empty-state-desc">Pick your roast above, then choose your drink to get the recipe.</div>
        </div>
      )}
    </div>
  )
}
