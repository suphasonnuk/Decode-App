import { Router, Request, Response, NextFunction } from 'express'
import { timingSafeEqual, createHash }              from 'crypto'
import { BigQuery }                                  from '@google-cloud/bigquery'
import { bigquery, BQ }                              from './bigquery'
import type { LogPayload, StreakResponse }            from './types'

const router = Router()

// ── Date helpers ──────────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayStr():     string { return localDateStr(new Date()) }
function yesterdayStr(): string { const d = new Date(); d.setDate(d.getDate()-1); return localDateStr(d) }
function weekStartStr(): string { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return localDateStr(d) }
function parseBQDate(val: unknown): string {
  if (val && typeof val === 'object' && 'value' in (val as object)) return (val as {value:string}).value
  return val as string
}

// ── Fix 2: Safe input sanitizer ───────────────────────────────────────────────
// Used for all user-supplied strings going into BQ parameterized queries.
// BigQuery params handle escaping — this is an extra layer for non-parameterized fields.
function safeStr(val: unknown, maxLen = 500): string {
  if (!val) return ''
  return String(val).slice(0, maxLen).replace(/[`'";\\]/g, '')
}

// ── Fix 5: Safe error — never leak internal details to client ─────────────────
function safeErr(err: unknown, context: string): string {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[${context}]`, msg)  // full error to Cloud Run logs only
  return 'An error occurred. Please try again.'
}

// ── Fix 6: Simple in-memory rate limiter for AI endpoints ─────────────────────
// Limits per IP: max 10 requests per 60 seconds per endpoint.
const rateLimitStore = new Map<string, { count: number; reset: number }>()
function rateLimit(maxReqs = 10, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key  = `${req.ip}:${req.path}`
    const now  = Date.now()
    const slot = rateLimitStore.get(key)
    if (!slot || now > slot.reset) {
      rateLimitStore.set(key, { count: 1, reset: now + windowMs })
      return next()
    }
    if (slot.count >= maxReqs) {
      return res.status(429).json({ error: 'Too many requests — please wait a moment' })
    }
    slot.count++
    next()
  }
}
// Periodically clean up expired rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimitStore) if (now > v.reset) rateLimitStore.delete(k)
}, 5 * 60_000)

// ── Fix 1: User-ID extraction helper ─────────────────────────────────────────
// All data endpoints require user_id. The client sends it via x-user-id header
// (for GET requests) or in the request body (for POST requests).
// user_id is a UUID generated once per device — it scopes all BigQuery rows.
// UUID v4 pattern (loose — accepts any hex UUID shape)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getUserId(req: Request): string | null {
  const fromHeader = req.headers['x-user-id'] as string | undefined
  const fromBody   = req.body?.user_id        as string | undefined
  const fromQuery  = req.query.user_id        as string | undefined
  const raw = (fromHeader || fromBody || fromQuery || '').trim()
  if (!raw) return null
  // Strict UUID validation — prevents injection via user_id
  if (!UUID_RE.test(raw)) return null
  return raw
}

// Clamp a numeric value to a valid 1–10 range for slider fields
function clampLevel(val: unknown): number | null {
  if (val == null) return null
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(1, Math.min(10, Math.round(n)))
}

// ── Fix 3: Auth middleware — timing-safe token comparison ─────────────────────
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.APP_SECRET
  if (!secret) { next(); return }  // no secret = open (dev mode)

  const token = String(req.headers['x-app-token'] || '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  // Constant-time comparison prevents timing attacks
  try {
    const a = Buffer.from(createHash('sha256').update(token).digest('hex'))
    const b = Buffer.from(createHash('sha256').update(secret).digest('hex'))
    if (!timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' })
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

const REQUIRED_FIELDS: (keyof LogPayload)[] = [
  'log_date', 'work_task', 'future_task', 'body_task', 'energy_level',
]

// ── POST /api/log ─────────────────────────────────────────────────────────────
router.post('/log', async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<LogPayload>
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    for (const field of REQUIRED_FIELDS) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return res.status(400).json({ error: `Missing required field: ${field}` })
      }
    }

    // Validate log_date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.log_date))) {
      return res.status(400).json({ error: 'Invalid log_date format — expected YYYY-MM-DD' })
    }

    // Validate day_outcome if provided
    const VALID_OUTCOMES = ['win', 'partial', 'miss']
    if (body.day_outcome && !VALID_OUTCOMES.includes(String(body.day_outcome))) {
      return res.status(400).json({ error: 'Invalid day_outcome — must be win, partial, or miss' })
    }

    const payload = body as LogPayload
    const row = {
      log_date:        safeStr(payload.log_date, 10),
      week_start:      safeStr(payload.week_start || weekStartStr(), 10),
      user_id:         userId,
      work_anchor:     payload.work_anchor     ? safeStr(payload.work_anchor)     : null,
      future_anchor:   payload.future_anchor   ? safeStr(payload.future_anchor)   : null,
      body_anchor:     payload.body_anchor     ? safeStr(payload.body_anchor)     : null,
      work_task:       safeStr(payload.work_task),
      future_task:     safeStr(payload.future_task),
      body_task:       safeStr(payload.body_task),
      work_done:       Boolean(payload.work_done),
      future_done:     Boolean(payload.future_done),
      body_done:       Boolean(payload.body_done),
      energy_level:    clampLevel(payload.energy_level) ?? 5,
      focus_level:     clampLevel(payload.focus_level),
      mood_level:      clampLevel(payload.mood_level),
      day_outcome:     payload.day_outcome     ?? null,
      tomorrow_action: payload.tomorrow_action ? safeStr(payload.tomorrow_action, 500) : null,
      reflection:      payload.reflection      ? safeStr(payload.reflection, 1000)     : null,
      submitted_at:    BigQuery.timestamp(new Date()),
    }

    await bigquery.dataset(BQ.DATASET).table(BQ.TABLE).insert([row])
    console.log(`[log] ${row.log_date} user:${userId.slice(0,8)} outcome:${row.day_outcome ?? 'pending'}`)
    return res.json({ success: true, log_date: row.log_date })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'log') })
  }
})

// ── GET /api/week ─────────────────────────────────────────────────────────────
router.get('/week', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const start = safeStr(req.query.start as string || weekStartStr(), 10)
    const end   = localDateStr(new Date(new Date(start + 'T12:00:00').getTime() + 6 * 86400000))

    // Fix 2: parameterized query
    const [rows] = await bigquery.query({
      query: `
        SELECT * EXCEPT(rn)
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
          WHERE user_id   = @userId
            AND log_date BETWEEN @start AND @end
        )
        WHERE rn = 1
        ORDER BY log_date ASC
      `,
      params: { userId, start, end },
    })
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'week') })
  }
})

// ── GET /api/today ────────────────────────────────────────────────────────────
router.get('/today', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT * FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
        WHERE user_id  = @userId
          AND log_date = @today
        ORDER BY submitted_at DESC
        LIMIT 1
      `,
      params: { userId, today: todayStr() },
    })
    return res.json(rows[0] ?? null)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'today') })
  }
})

// ── GET /api/yesterday ────────────────────────────────────────────────────────
router.get('/yesterday', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT tomorrow_action
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
        WHERE user_id  = @userId
          AND log_date = @yesterday
          AND tomorrow_action IS NOT NULL
        ORDER BY submitted_at DESC
        LIMIT 1
      `,
      params: { userId, yesterday: yesterdayStr() },
    })
    return res.json({ tomorrow_action: rows[0]?.tomorrow_action ?? null })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'yesterday') })
  }
})

// ── GET /api/anchors/week ─────────────────────────────────────────────────────
router.get('/anchors/week', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT work_anchor, future_anchor, body_anchor
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
        WHERE user_id  = @userId
          AND log_date >= @weekStart
          AND (work_anchor IS NOT NULL OR future_anchor IS NOT NULL OR body_anchor IS NOT NULL)
        ORDER BY submitted_at DESC
        LIMIT 1
      `,
      params: { userId, weekStart: weekStartStr() },
    })
    if (rows.length === 0) return res.json(null)
    return res.json({ work: rows[0].work_anchor ?? '', future: rows[0].future_anchor ?? '', body: rows[0].body_anchor ?? '' })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'anchors') })
  }
})

// ── GET /api/streak ───────────────────────────────────────────────────────────
router.get('/streak', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT log_date, day_outcome
        FROM (
          SELECT log_date, day_outcome,
            ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
          WHERE user_id  = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
            AND log_date <= CURRENT_DATE()
        )
        WHERE rn = 1
        ORDER BY log_date DESC
      `,
      params: { userId },
    })

    const today = todayStr()

    // ── WIN streak — consecutive days with day_outcome = 'win' ──────────────
    // current = streak from today backwards (stops at first non-win)
    // longest30 = longest win run in last 30 days (scans all rows)
    let current = 0, longest30 = 0, currentRun = 0
    let currentDone = false  // once we break the current streak, stop counting it
    for (const row of rows) {
      const date = parseBQDate(row.log_date)
      if (date === today && !row.day_outcome) continue
      if (row.day_outcome === 'win') {
        if (!currentDone) current++
        currentRun++
        longest30 = Math.max(longest30, currentRun)
      } else {
        currentDone = true
        currentRun = 0
      }
    }

    // ── Login streak — consecutive days with ANY log (morning OR night) ─────
    // A day counts even if only the morning log was submitted (no outcome yet).
    // Consecutive = no gap of a full calendar day.
    let loginStreak = 0
    const rowDates = new Set(rows.map((r: any) => parseBQDate(r.log_date)))

    // Also count today if it has a log even without outcome
    const todayHasLog = rows.some((r: any) => parseBQDate(r.log_date) === today)

    // Walk backwards from today, checking consecutive days
    const checkDate = new Date()
    for (let i = 0; i < 90; i++) {
      const dateStr = localDateStr(checkDate)
      if (rowDates.has(dateStr)) {
        loginStreak++
      } else if (i === 0) {
        // Today has no log yet — don't break, just skip today
      } else {
        break  // gap found
      }
      checkDate.setDate(checkDate.getDate() - 1)
    }

    return res.json({ current, longest30, login_streak: loginStreak })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'streak') })
  }
})

// ── GET /api/trends ───────────────────────────────────────────────────────────
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT log_date, energy_level, focus_level, mood_level, day_outcome
        FROM (
          SELECT log_date, energy_level, focus_level, mood_level, day_outcome,
            ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
          WHERE user_id  = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        )
        WHERE rn = 1
        ORDER BY log_date ASC
      `,
      params: { userId },
    })
    return res.json(rows.map((r: any) => ({ ...r, log_date: parseBQDate(r.log_date) })))
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'trends') })
  }
})

// ── GET /api/history ──────────────────────────────────────────────────────────
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
          work_done, future_done, body_done, work_task, future_task, body_task
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
          WHERE user_id  = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        )
        WHERE rn = 1
        ORDER BY log_date DESC
      `,
      params: { userId },
    })
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'history') })
  }
})

// ── GET /api/profile/:user_id ─────────────────────────────────────────────────
router.get('/profile/:user_id', async (req: Request, res: Response) => {
  try {
    const uid = safeStr(req.params.user_id, 100)
    if (!uid) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT * FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_profile\`
        WHERE user_id = @uid
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      params: { uid },
    })
    return res.json(rows[0] ?? null)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'profile.get') })
  }
})

// ── POST /api/profile ─────────────────────────────────────────────────────────
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const b   = req.body
    const now = BigQuery.timestamp(new Date())

    // Validate birth_year if provided
    if (b.birth_year != null) {
      const year = Number(b.birth_year)
      if (isNaN(year) || year < 1920 || year > new Date().getFullYear() - 10) {
        return res.status(400).json({ error: 'Invalid birth year' })
      }
    }

    // Validate numeric fields
    if (b.height_cm != null && (Number(b.height_cm) < 50 || Number(b.height_cm) > 300)) {
      return res.status(400).json({ error: 'Height must be between 50-300 cm' })
    }
    if (b.weight_kg != null && (Number(b.weight_kg) < 20 || Number(b.weight_kg) > 500)) {
      return res.status(400).json({ error: 'Weight must be between 20-500 kg' })
    }

    const row = {
      user_id:                 userId,
      name:                    b.name             ? safeStr(b.name, 100)       : null,
      email:                   b.email            ? safeStr(b.email, 200)      : null,
      birth_year:              b.birth_year       ? Number(b.birth_year)       : null,
      gender:                  b.gender           ? safeStr(b.gender, 50)      : null,
      occupation:              b.occupation       ? safeStr(b.occupation, 100) : null,
      primary_goal:            b.primary_goal     ? safeStr(b.primary_goal, 100) : null,
      sleep_target_hrs:        b.sleep_target_hrs ? Number(b.sleep_target_hrs) : null,
      timezone:                safeStr(b.timezone || 'Asia/Bangkok', 50),
      // Body metrics for TDEE
      height_cm:               b.height_cm               != null ? Number(b.height_cm)               : null,
      weight_kg:               b.weight_kg               != null ? Number(b.weight_kg)               : null,
      exercise_days_per_week:  b.exercise_days_per_week  != null ? Number(b.exercise_days_per_week)  : null,
      fitness_goal:            b.fitness_goal             ? safeStr(b.fitness_goal, 50)               : null,
      created_at:              now,
      updated_at:              now,
    }
    await bigquery.dataset(BQ.DATASET).table('user_profile').insert([row])
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'profile.post') })
  }
})

// ── POST /api/coach — Fix 6: rate limited ────────────────────────────────────
router.post('/coach', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI coach not configured' })

    // Fix 2: parameterized queries for coach data
    const [logs, profileRows] = await Promise.all([
      bigquery.query({
        query: `
          SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
            work_task, future_task, body_task, work_done, future_done, body_done,
            tomorrow_action, reflection
          FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
            FROM \`${BQ.PROJECT}.${BQ.DATASET}.daily_log\`
            WHERE user_id  = @userId
              AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          )
          WHERE rn = 1
          ORDER BY log_date DESC
        `,
        params: { userId },
      }),
      bigquery.query({
        query: `
          SELECT name, occupation, primary_goal, sleep_target_hrs, birth_year
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_profile\`
          WHERE user_id = @userId
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        params: { userId },
      }),
    ])

    const rows    = logs[0] as any[]
    const profile = profileRows[0][0] as any ?? {}

    if (rows.length < 3) {
      return res.json({
        greeting: 'Keep logging!', summary: 'You need at least 3–4 days of data before I can give you meaningful insights. Come back after a few more days.',
        patterns: [], action: 'Keep logging morning + night for the next few days.', score: null,
      })
    }

    const wins     = rows.filter(r => r.day_outcome === 'win').length
    const partials = rows.filter(r => r.day_outcome === 'partial').length
    const misses   = rows.filter(r => r.day_outcome === 'miss').length
    const logged   = rows.filter(r => r.day_outcome).length
    const winRate  = logged > 0 ? Math.round((wins / logged) * 100) : 0
    const avg      = (key: string) => {
      const vals = rows.filter(r => r[key]).map(r => r[key])
      return vals.length ? (vals.reduce((a:number,b:number)=>a+b,0)/vals.length).toFixed(1) : '?'
    }
    const winDays = rows.filter(r => r.day_outcome === 'win')
    const bodyRate = winDays.length > 0 ? Math.round((winDays.filter(r=>r.body_done).length/winDays.length)*100) : 0

    // Coach dataContext — no nested backticks
    const recentRows = rows.slice(0, 14).map(r => {
      const d   = parseBQDate(r.log_date)
      const out = r.day_outcome?.toUpperCase() || 'no outcome'
      const wk  = safeStr(r.work_task, 50)
      return d + ': ' + out + ' e=' + (r.energy_level||'?') + ' f=' + (r.focus_level||'?') + ' m=' + (r.mood_level||'?') + ' body=' + r.body_done + ' work="' + wk + '"'
    }).join('\n')
    const reflRows = rows.filter(r => r.reflection).slice(0, 5).map(r => {
      return parseBQDate(r.log_date) + ': "' + safeStr(r.reflection, 200) + '"'
    }).join('\n') || 'None'

    const dataContext =
      'USER PROFILE: Name: ' + (profile.name||'Unknown') + ', Occupation: ' + (profile.occupation||'Unknown') + ', Goal: ' + (profile.primary_goal||'Unknown') + ', Sleep target: ' + (profile.sleep_target_hrs||'?') + 'h\n\n' +
      'LAST 30 DAYS (' + rows.length + ' days logged):\n' +
      '- WIN/PARTIAL/MISS: ' + wins + '/' + partials + '/' + misses + '  Win rate: ' + winRate + '%\n' +
      '- Avg energy: ' + avg('energy_level') + '  focus: ' + avg('focus_level') + '  mood: ' + avg('mood_level') + '\n' +
      '- Body habit done on WIN days: ' + bodyRate + '%\n\n' +
      'RECENT DAYS (newest first):\n' + recentRows + '\n\n' +
      'REFLECTIONS:\n' + reflRows

    // Fix 13: 30-second timeout on Anthropic call
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 30_000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1000,
        messages: [{ role: 'user', content: `=== CONTEXT ===\nThis is a performance coaching session for the DECODE personal productivity and health tracking app.\nThe user logs every day: 3 tasks (work, future goal, body habit), energy (1-10), focus (1-10), mood (1-10), and a day outcome (WIN/PARTIAL/MISS).\nThe user's long-term vision: build their own business in the health and longevity space within 3-5 years.\n\n=== YOUR ROLE ===\nYou are a world-class performance coach. Direct, warm, data-driven.\n\n=== THEIR DATA ===\n${dataContext}\n\n=== TASK ===\nWrite coaching in valid JSON only, no preamble:\n{"greeting":"...","summary":"...","patterns":["...","...","..."],"action":"...","score":7}` }],
      }),
    }).finally(() => clearTimeout(timeout))

    if (!anthropicRes.ok) {
      console.error('[coach] Anthropic error:', anthropicRes.status)
      return res.status(502).json({ error: 'AI coach unavailable' })
    }

    const data     = await anthropicRes.json() as any
    const raw      = data.content?.[0]?.text ?? '{}'
    const coaching = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return res.json({ ...coaching, data_points: rows.length, win_rate: winRate })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'coach')
    return res.status(500).json({ error: msg })
  }
})

// ── POST /api/push/subscribe ──────────────────────────────────────────────────
router.post('/push/subscribe', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const { endpoint, keys, notify_morning, notify_evening } = req.body
    if (!endpoint || !keys) return res.status(400).json({ error: 'Missing required fields' })

    const now = BigQuery.timestamp(new Date())
    try {
      await bigquery.dataset(BQ.DATASET).table('push_subscriptions').insert([{
        user_id: userId, endpoint: String(endpoint),
        p256dh: String(keys.p256dh), auth: String(keys.auth),
        notify_morning: notify_morning !== false, notify_evening: notify_evening !== false,
        created_at: now, updated_at: now,
      }])
    } catch { console.warn('[push] push_subscriptions table not found') }
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'push.subscribe') })
  }
})

// ── POST /api/push/send — Cloud Scheduler only ────────────────────────────────
router.post('/push/send', async (req: Request, res: Response) => {
  try {
    const schedulerSecret = process.env.SCHEDULER_SECRET
    const incoming        = String(req.headers['x-scheduler-secret'] || '')
    // Fix 3: timing-safe comparison for scheduler secret too
    if (schedulerSecret) {
      try {
        const a = Buffer.from(createHash('sha256').update(incoming).digest('hex'))
        const b = Buffer.from(createHash('sha256').update(schedulerSecret).digest('hex'))
        if (!timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' })
      } catch { return res.status(401).json({ error: 'Unauthorized' }) }
    }

    const { type } = req.body
    if (!type) return res.status(400).json({ error: 'Missing type' })

    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
    const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
    if (!VAPID_PRIVATE || !VAPID_PUBLIC) return res.status(503).json({ error: 'VAPID keys not configured' })

    const webPush  = await import('web-push')
    webPush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@decode.app', VAPID_PUBLIC, VAPID_PRIVATE)

    const col     = type === 'morning' ? 'notify_morning' : 'notify_evening'
    const payload = JSON.stringify(type === 'morning'
      ? { title: '🦞 DECODE', body: 'Pick your 3 tasks for today', url: '/' }
      : { title: '🦞 DECODE', body: 'Close the day — keep your streak alive', url: '/' })

    const [rows] = await bigquery.query({
      query: `
        SELECT endpoint, p256dh, auth FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.push_subscriptions\`
          WHERE ${col} = TRUE
        ) WHERE rn = 1
      `,
    })

    let sent = 0
    for (const row of rows as any[]) {
      try {
        await webPush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload)
        sent++
      } catch { /* expired subscription */ }
    }
    console.log(`[push] Sent ${type}: ${sent}/${rows.length}`)
    return res.json({ success: true, sent, total: rows.length })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'push.send') })
  }
})

// ════════════════════════════════════════════════════════════════════════
// NUTRITION TRACKER
// ════════════════════════════════════════════════════════════════════════

// ── POST /api/nutrition/analyze — Fix 6: rate limited ────────────────────────
router.post('/nutrition/analyze', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  try {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' })

    const { image_base64, image_media_type, dish_name } = req.body
    if (!image_base64 && !dish_name) return res.status(400).json({ error: 'Provide either image_base64 or dish_name' })

    // Guard: reject images larger than 10MB base64 (~7.5MB raw)
    if (image_base64 && typeof image_base64 === 'string' && image_base64.length > 10_000_000) {
      return res.status(400).json({ error: 'Image too large — max 10MB' })
    }

    // Validate media type
    const VALID_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (image_base64 && image_media_type && !VALID_MEDIA.includes(image_media_type)) {
      return res.status(400).json({ error: 'Invalid image type — use JPEG, PNG, or WebP' })
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DUAL-MODEL NUTRITION ESTIMATION
    // ══════════════════════════════════════════════════════════════════════════
    // Architecture:
    //   PASS 1 — Estimator: chain-of-thought scaffold, temperature=0, few-shot
    //   PASS 2 — Verifier: independent critic, different framing, temperature=0
    //   RECONCILE: if calories diverge >15%, average with adjustment note
    //
    // Techniques applied:
    //   - temperature=0 for deterministic output (no randomness)
    //   - Chain-of-thought: model writes reasoning before answering
    //   - Few-shot calibration: 3 verified reference dishes anchor the scale
    //   - Role + methodology priming: USDA Atwater factors, McCance tables
    //   - Ingredient-level buildup: not top-down guessing
    //   - Mandatory macro cross-check: calories = P*4 + C*4 + F*9
    //   - Independent verifier: separate model pass as critic not estimator

    // ── Shared references ────────────────────────────────────────────────────

    const PROTEIN_DENSITY_TABLE =
      'PROTEIN DENSITY REFERENCE (g protein per 100g COOKED weight — use these exact values):\n' +
      '  Chicken breast (cooked, no skin):  31g P/100g\n' +
      '  Chicken thigh (cooked, no skin):   26g P/100g\n' +
      '  Chicken with skin:                 24g P/100g\n' +
      '  Pork loin/tenderloin (cooked):     27g P/100g\n' +
      '  Ground pork (cooked):              17g P/100g  ← commonly overestimated\n' +
      '  Pork belly (cooked):               16g P/100g  ← high fat, lower protein ratio\n' +
      '  Moo ping / grilled pork skewer:    20g P/100g  ← marinated, mixed cuts\n' +
      '  Beef (cooked, lean):               26g P/100g\n' +
      '  Shrimp (cooked):                   24g P/100g\n' +
      '  Fish fillet (cooked, white fish):  22g P/100g\n' +
      '  Egg (whole, 50g):                   6g P each\n' +
      '  Tofu (firm):                         8g P/100g\n' +
      '  Jasmine rice (cooked):               2.7g P/100g  ← very low, often over-assigned\n' +
      '  Noodles (cooked):                    3g P/100g\n' +
      '  Vegetables (mixed Thai):             1-2g P/100g  ← do not assign more\n' +
      '  Thai sauces (fish/oyster/soy 20g):   1g P total   ← almost no protein\n\n' +
      'PROTEIN REALITY CHECK: After estimating protein_g, verify:\n' +
      '  (protein source weight in grams) × (protein density from table above) / 100 = expected protein_g\n' +
      '  If your protein_g is more than 20% above this, reduce it to match the table.'

    const ATWATER_FACTORS =
      'CALORIE CALCULATION (Atwater general factors — use exactly these):\n' +
      '  Protein:       4.0 kcal/g\n' +
      '  Carbohydrates: 4.0 kcal/g\n' +
      '  Fat:           9.0 kcal/g\n' +
      '  Alcohol:       7.0 kcal/g (ignore unless present)\n' +
      'Total calories MUST equal (protein_g × 4) + (carbs_g × 4) + (fat_g × 9). Verify before outputting.'

    const THAI_EATING_CONTEXT =
      'THAI EATING CONTEXT — this is critical for accurate estimation:\n\n' +
      'USER PROFILE: This app is used by Thai people living in Bangkok, Thailand. ' +
      'Average Thai adult: male ~165cm/65kg, female ~158cm/54kg. ' +
      'Daily calorie needs: Thai male ~1800-2100kcal, Thai female ~1500-1800kcal. ' +
      'Thai portions are calibrated to these body sizes — significantly smaller than Western portions.\n\n' +
      'HOW THAI PEOPLE EAT:\n' +
      '- Rice is the foundation: 1 cup cooked jasmine rice (~150g, 195kcal) is the base of most meals\n' +
      '- Protein is a SIDE DISH: In Thai culture, protein dishes are shared or served in small amounts alongside rice. ' +
      'A single-person order typically contains only 60-100g of actual meat — not 120-180g as in Western portions\n' +
      '- Street food portions are smaller: street food stalls in Bangkok serve 300-380g total (plate+rice). ' +
      'Restaurant portions for tourists may be slightly larger but still within Thai norms\n' +
      '- Office lunch (popular in Bangkok): typically 35-45 baht meals, small plate with rice, 50-80g protein, small vegetable portion\n' +
      '- Shared dishes: if someone photographs a shared dish (gaeng, tom yum, stir-fry in a central bowl), ' +
      'estimate per-person serving as 1/3 to 1/4 of the total dish visible\n\n' +
      'PORTION SIZE REALITY CHECK FOR THAI CONTEXT:\n' +
      '- A Thai chicken stir-fry single serve: 60-90g chicken (NOT 120-150g)\n' +
      '- A Thai pork dish single serve: 70-100g pork (NOT 120-180g)\n' +
      '- A bowl of Thai soup/curry: 150-200ml liquid + 60-80g protein + vegetables\n' +
      '- Total calories for a typical Thai lunch: 400-600kcal (NOT 700-900kcal)\n' +
      '- Total calories for a typical Thai dinner: 450-650kcal\n' +
      '- If your estimate for a single Thai meal exceeds 700kcal, double-check your portion assumptions\n\n' +
      'WHAT THAI FOOD IS NOT:\n' +
      '- Not a Western steak (200-300g protein)\n' +
      '- Not an American portion (supersized, high protein)\n' +
      '- Not a gym meal prep (lean chicken breast 150g+)\n' +
      'The protein in a Thai dish is typically a small component alongside rice, vegetables, and sauce.'

    const PORTION_TABLE =
      'STANDARD PORTION WEIGHTS (use as anchors — do not deviate without clear visual evidence):\n' +
      '  Thai plate with rice:      350–420g total | rice ~150g | protein+sauce 170–220g | veg 30–50g\n' +
      '  Thai curry (no rice):      200–250g\n' +
      '  Pad Thai single serve:     280–320g\n' +
      '  Som tum small bowl:        150–180g\n' +
      '  Moo ping x3 skewers:       90–120g\n' +
      '  Khao man gai plate:        380–420g total\n' +
      '  Noodle soup bowl:          450–550g total\n' +
      '  Bakery item / cookie each: 25–45g\n' +
      '  Thai milk tea medium:      350ml | full sugar ~280kcal | half sugar ~160kcal\n' +
      '  Non-Thai: use USDA SR / NHS standard portion references.'

    const FEW_SHOT_EXAMPLES =
      'CALIBRATION EXAMPLES (verified reference values — use these to calibrate your scale):\n\n' +
      'Example 1 — Khao pad gai (chicken fried rice, Thai restaurant single plate):\n' +
      '  Ingredients: jasmine rice 180g (234kcal), chicken breast 80g (88kcal), egg 1 whole 50g (72kcal), ' +
      'oil 12g (108kcal), vegetables 40g (15kcal), soy+oyster sauce 20g (25kcal)\n' +
      '  Total: 380g | 542kcal | protein 28g | carbs 62g | fat 20g | sodium 820mg\n' +
      '  Macro check: 28*4 + 62*4 + 20*9 = 112+248+180 = 540kcal ≈ 542 ✓\n\n' +
      'Example 2 — Pad kra pao moo (basil pork, no rice):\n' +
      '  Ingredients: ground pork 120g cooked (~17g P/100g cooked = 20g protein, 240kcal), ' +
      'oil 15g (135kcal, 0g protein), fish sauce+oyster sauce 25g (30kcal, 1g protein), ' +
      'basil+vegetables 40g (12kcal, 1g protein)\n' +
      '  Total: 200g | 417kcal | protein 22g | carbs 10g | fat 32g | sodium 1050mg\n' +
      '  Macro check: 22*4 + 10*4 + 32*9 = 88+40+288 = 416kcal ≈ 417 ✓\n' +
      '  NOTE: Ground pork is leaner than assumed — do not assign >20-22g protein for 120g cooked\n\n' +
      'Example 3 — 5 butter cookies (Thai bakery gift box style, ~30g each):\n' +
      '  Ingredients per cookie: butter 8g (72kcal), flour 14g (51kcal), sugar 7g (28kcal), jam 1g (3kcal)\n' +
      '  Per cookie: 30g | 154kcal | protein 1.5g | carbs 18g | fat 8g | sodium 55mg\n' +
      '  5 cookies: 150g | 770kcal | protein 7.5g | carbs 90g | fat 40g | sodium 275mg'

    // ── PASS 1: Estimator ─────────────────────────────────────────────────────

    const estimatorSystem =
      'You are a registered dietitian with 20 years of clinical practice based in Bangkok, Thailand. ' +
      'You are trained in the McCance and Widdowson food composition tables and USDA SR database. ' +
      'You specialise in Thai and Southeast Asian cuisine and understand exactly how Thai people eat — ' +
      'smaller portions, rice-based meals, protein as a side component, not a Western-style main.\n\n' +
      'YOUR METHOD: Always build nutrition estimates from ingredients up — never guess the total directly. ' +
      'Always apply Thai portion context — a Thai single serving has 60-100g protein source, not 120-180g.\n\n' +
      THAI_EATING_CONTEXT + '\n\n' +
      PORTION_TABLE + '\n\n' +
      PROTEIN_DENSITY_TABLE + '\n\n' +
      ATWATER_FACTORS + '\n\n' +
      FEW_SHOT_EXAMPLES + '\n\n' +
      'ACCURACY RULE: Your estimate must represent the statistical median — not the high end, not the low end. ' +
      'Do not add safety buffer. Do not hedge by estimating high. ' +
      'Another dietitian estimating the same dish must land within 10% of your calories.\n\n' +
      'CHAIN-OF-THOUGHT: You MUST show your reasoning in the notes field. ' +
      'Format: "Ingredients: [item Xg=Ykcal, ...]. Macro check: P*4+C*4+F*9=[Z]kcal ✓"\n\n' +
      'OUTPUT: Respond with ONLY valid JSON — no preamble, no markdown. NUMBERS ONLY — no explanatory text, no health advice:\n' +
      JSON.stringify({
        dish_name: 'exact dish name',
        serving_description: 'e.g. 1 plate (~390g) with jasmine rice',
        estimated_weight_g: 0,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        confidence: 'high',
        notes: 'ONE LINE ONLY: ingredient weights and macro check. e.g. rice 150g+chicken 80g=542kcal, 28*4+62*4+20*9=540✓',
      }, null, 2) +
      '\nDo NOT include health_impact, recommendations, or any explanatory text. Numbers and dish name only.'

    const estimatorMsg: any[] = image_base64 ? [
      { type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } },
      { type: 'text', text:
        'Analyze this food image using your ingredient-buildup method:\n' +
        'Step 1: Identify the dish and all visible ingredients\n' +
        'Step 2: Estimate weight of each ingredient using the portion table\n' +
        'Step 3: Calculate kcal for each ingredient using Atwater factors\n' +
        'Step 4: Sum to get total macros\n' +
        'Step 5: PROTEIN CHECK — for each protein source: weight(g) × density(g/100g) / 100 = protein_g. Use the density table. Do not inflate.\n' +
        'Step 6: Verify calories = (P×4)+(C×4)+(F×9). Adjust macros if off by >5%\n' +
        'Step 7: Output JSON with full reasoning in notes field\n\n' +
        'Aim for the median estimate. Do not inflate. Protein is the most commonly overestimated macro.\n' +
        'Remember: this is a Thai person in Bangkok eating a typical Thai meal. ' +
        'Protein portion is likely 60-100g of meat, not 120-180g. Total meal likely 400-600kcal.'
      },
    ] : [
      { type: 'text', text:
        'Estimate nutrition for: "' + safeStr(dish_name, 200) + '"\n\n' +
        'Use your ingredient-buildup method:\n' +
        'Step 1: State the standard serving size (use portion table)\n' +
        'Step 2: List each ingredient with estimated weight\n' +
        'Step 3: Calculate kcal per ingredient using Atwater factors\n' +
        'Step 4: Sum macros\n' +
        'Step 5: PROTEIN CHECK — for each protein source: weight(g) × density(g/100g) / 100 = protein_g. Use the density table.\n' +
        'Step 6: Verify calories = (P×4)+(C×4)+(F×9). Adjust macros if off\n' +
        'Step 7: Output JSON with reasoning in notes\n\n' +
        'Aim for the statistical median. Protein is the most commonly overestimated macro — use density table values.\n' +
        'Remember: Thai Bangkok portion. Protein source is likely 60-100g. Total meal likely 400-600kcal. ' +
        'If total exceeds 700kcal for a single Thai meal, reconsider your portion assumptions.'
      },
    ]

    // ── PASS 2: Verifier ─────────────────────────────────────────────────────

    const verifierSystem =
      'You are a senior clinical nutritionist acting as a peer reviewer. ' +
      'Another nutritionist has estimated the nutrition for a dish. ' +
      'Your job is to independently verify or correct their estimate.\n\n' +
      THAI_EATING_CONTEXT + '\n\n' +
      PORTION_TABLE + '\n\n' +
      PROTEIN_DENSITY_TABLE + '\n\n' +
      ATWATER_FACTORS + '\n\n' +
      FEW_SHOT_EXAMPLES + '\n\n' +
      'CRITICAL RULES:\n' +
      '1. Make your OWN independent estimate first — do not just confirm the first estimate\n' +
      '2. Check if the macro math is correct: calories must = (P×4)+(C×4)+(F×9)\n' +
      '3. Check if the portion size is realistic for THAI Bangkok context:\n' +
      '   - Single Thai meal total: 400-600kcal is typical. Above 700kcal needs justification.\n' +
      '   - Protein source per single serve: 60-100g is Thai standard. Flag if estimator used >120g.\n' +
      '4. PROTEIN IS THE MOST COMMONLY OVERESTIMATED MACRO. Verify protein using the density table:\n' +
      '   (protein source weight g) × (density g/100g) / 100 = expected protein_g\n' +
      '   If estimated protein exceeds this by >20%, flag it and reduce.\n' +
      '5. Common protein overestimation patterns to catch:\n' +
      '   - Assigning >25g protein to a dish with only 80-100g of mixed/fatty meat\n' +
      '   - Assigning protein to rice, noodles, or sauces above 3g/100g\n' +
      '   - Using chicken breast density (31g/100g) for mixed/fatty cuts or ground meat\n' +
      '6. If you agree on calories but disagree on protein distribution, still provide corrected macros\n' +
      '7. If you agree (within 10% calories AND protein within 15%), confirm the estimate\n\n' +
      'OUTPUT: Respond with ONLY valid JSON — no preamble:\n' +
      JSON.stringify({
        agrees: true,
        verified_calories: 0,
        verified_protein_g: 0,
        verified_carbs_g: 0,
        verified_fat_g: 0,
        verified_fiber_g: 0,
        verified_sugar_g: 0,
        verified_sodium_mg: 0,
        verified_estimated_weight_g: 0,
        disagreement_reason: 'null or explanation if disagrees',
        confidence: 'high',
      }, null, 2)

        // ── Helper: call Anthropic with timeout + robust JSON parse ─────────────────
    const callAI = async (
      system: string, messages: any[], label: string,
      model = 'claude-sonnet-4-6', maxTokens = 600
    ): Promise<any> => {
      const ctrl    = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 35_000)
      const res     = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system, messages }),
      }).finally(() => clearTimeout(timeout))

      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error('[' + label + '] API error ' + res.status + ': ' + t.slice(0, 100))
      }
      const data = await res.json() as any
      const raw  = data.content?.[0]?.text ?? ''
      if (!raw) throw new Error('[' + label + '] Empty response')

      let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
      if (s !== -1 && e > s) clean = clean.slice(s, e + 1)
      return JSON.parse(clean)
    }

    // ── PASS 1: Estimator ─────────────────────────────────────────────────────
    let estimate: any
    try {
      estimate = await callAI(estimatorSystem, [{ role: 'user', content: estimatorMsg }], 'estimator', 'claude-sonnet-4-6', 600)
    } catch (err) {
      console.error('[nutrition/analyze] Estimator failed:', (err as Error).message)
      return res.status(502).json({ error: 'Nutrition analysis failed — please try again' })
    }

    // ── PASS 2: Verifier ─────────────────────────────────────────────────────
    // Give verifier the estimator result + the original image/name
    const verifierInput = image_base64
      ? 'The nutritionist estimated this dish from the image. Review their estimate and provide your independent verification.\n\nTheir estimate:\n' + JSON.stringify(estimate, null, 2)
      : 'The nutritionist estimated nutrition for "' + safeStr(dish_name, 200) + '". Review and verify:\n\n' + JSON.stringify(estimate, null, 2)

    const verifierMessages: any[] = image_base64
      ? [
          { type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } },
          { type: 'text', text: verifierInput },
        ]
      : [{ type: 'text', text: verifierInput }]

    let verification: any
    try {
      verification = await callAI(verifierSystem, [{ role: 'user', content: verifierMessages }], 'verifier', 'claude-sonnet-4-6', 400)
    } catch (err) {
      // Verifier failure is non-critical — fall back to estimator result
      console.warn('[nutrition/analyze] Verifier failed, using estimator only:', (err as Error).message)
      return res.json({ success: true, nutrition: estimate, source: image_base64 ? 'ai_image' : 'ai_text', verified: false })
    }

    // ── RECONCILE ─────────────────────────────────────────────────────────────
    // If verifier agrees: use verifier's confirmed values (may have minor corrections)
    // If verifier disagrees (>15% calorie difference): average and note it
    const estCal   = Number(estimate.calories)        || 0
    const verCal   = Number(verification.verified_calories) || 0
    const diverges = estCal > 0 && verCal > 0 && Math.abs(estCal - verCal) / estCal > 0.15

    let finalNutrition: any
    if (!diverges || verification.agrees) {
      // Agreement or minor difference — use verifier's values (they may have corrected small errors)
      finalNutrition = {
        ...estimate,
        calories:             verCal   || estCal,
        protein_g:            Number(verification.verified_protein_g)   || estimate.protein_g,
        carbs_g:              Number(verification.verified_carbs_g)      || estimate.carbs_g,
        fat_g:                Number(verification.verified_fat_g)        || estimate.fat_g,
        fiber_g:              Number(verification.verified_fiber_g)      || estimate.fiber_g,
        sugar_g:              Number(verification.verified_sugar_g)      || estimate.sugar_g,
        sodium_mg:            Number(verification.verified_sodium_mg)    || estimate.sodium_mg,
        estimated_weight_g:   Number(verification.verified_estimated_weight_g) || estimate.estimated_weight_g,
        confidence:           verification.confidence || estimate.confidence,
      }
    } else {
      // Significant disagreement — average the two estimates
      const avg = (a: number, b: number) => a && b ? Math.round((a + b) / 2) : (a || b)
      finalNutrition = {
        ...estimate,
        calories:           avg(estCal,   verCal),
        protein_g:          avg(Number(estimate.protein_g),   Number(verification.verified_protein_g)),
        carbs_g:            avg(Number(estimate.carbs_g),     Number(verification.verified_carbs_g)),
        fat_g:              avg(Number(estimate.fat_g),       Number(verification.verified_fat_g)),
        fiber_g:            avg(Number(estimate.fiber_g),     Number(verification.verified_fiber_g)),
        sugar_g:            avg(Number(estimate.sugar_g),     Number(verification.verified_sugar_g)),
        sodium_mg:          avg(Number(estimate.sodium_mg),   Number(verification.verified_sodium_mg)),
        confidence:         'medium',
        notes:              (estimate.notes || '') + ' | Estimates diverged (' + estCal + ' vs ' + verCal + 'kcal) — averaged. ' + (verification.disagreement_reason || ''),
      }
      console.log('[nutrition/analyze] Divergence: estimator=' + estCal + ' verifier=' + verCal + ' final=' + finalNutrition.calories)
    }

    // ── PASS 3: Haiku — health impact text generation ────────────────────────
    // Haiku is ~20x cheaper than Sonnet per token.
    // It only receives the verified numbers + dish name — no image, no tables.
    // All expensive context (Thai tables, protein density, few-shot) stays in Sonnet only.
    const haikusystem =
      'You are a nutrition communicator. Given verified nutrition facts for a dish, ' +
      'write a brief, accurate health impact summary. Be specific — reference actual nutrient values. ' +
      'Do not be alarmist. Be balanced and practical. Keep it concise.\n\n' +
      'OUTPUT: Respond with ONLY valid JSON:\n' +
      JSON.stringify({
        rating: 'positive|neutral|mixed|negative',
        summary: '2-3 plain sentences about the main health effects of this specific dish based on its actual numbers.',
        highlights: ['One specific benefit with the nutrient name and amount', 'Second benefit if applicable'],
        watch: 'One specific concern based on the numbers, or null if none',
      }, null, 2) +
      '\nrating guide: positive=mostly beneficial nutrients | neutral=balanced, ok in moderation | ' +
      'mixed=some benefits and some concerns | negative=high in nutrients to limit (sugar/sat fat/sodium)'

    const haikuInput =
      'Dish: ' + (finalNutrition.dish_name || 'Unknown dish') + '\n' +
      'Serving: ' + (finalNutrition.serving_description || '') + '\n' +
      'Nutrition facts:\n' +
      '  Calories: ' + finalNutrition.calories + 'kcal\n' +
      '  Protein: ' + finalNutrition.protein_g + 'g\n' +
      '  Carbs: ' + finalNutrition.carbs_g + 'g\n' +
      '  Fat: ' + finalNutrition.fat_g + 'g\n' +
      '  Fiber: ' + finalNutrition.fiber_g + 'g\n' +
      '  Sugar: ' + finalNutrition.sugar_g + 'g\n' +
      '  Sodium: ' + finalNutrition.sodium_mg + 'mg\n\n' +
      'Write a brief health impact summary for this dish.'

    let healthImpact: any = null
    try {
      healthImpact = await callAI(
        haikusystem,
        [{ role: 'user', content: haikuInput }],
        'health-impact',
        'claude-haiku-4-5-20251001',
        400
      )
    } catch (err) {
      // Health impact failure is non-critical — nutrition numbers are already correct
      console.warn('[nutrition/analyze] Haiku health impact failed:', (err as Error).message)
    }

    return res.json({
      success: true,
      nutrition: { ...finalNutrition, health_impact: healthImpact },
      source: image_base64 ? 'ai_image' : 'ai_text',
      verified: true,
    })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Analysis timed out — try again' : safeErr(err, 'nutrition.analyze')
    return res.status(500).json({ error: msg })
  }
})

// ── POST /api/nutrition/log ───────────────────────────────────────────────────
router.post('/nutrition/log', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const b = req.body
    if (!b.dish_name) return res.status(400).json({ error: 'Missing dish_name' })

    const entry_id = 'nu_' + Date.now() + '_' + Math.random().toString(36).slice(2,9)
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id, user_id: userId, log_date: localDateStr(new Date()), logged_at: BigQuery.timestamp(new Date()),
      meal_type:  b.meal_type  ? safeStr(b.meal_type, 50)   : null,
      dish_name:  safeStr(b.dish_name, 200),
      calories:   b.calories   != null ? Number(b.calories)   : null,
      protein_g:  b.protein_g  != null ? Number(b.protein_g)  : null,
      carbs_g:    b.carbs_g    != null ? Number(b.carbs_g)    : null,
      fat_g:      b.fat_g      != null ? Number(b.fat_g)      : null,
      fiber_g:    b.fiber_g    != null ? Number(b.fiber_g)    : null,
      sugar_g:    b.sugar_g    != null ? Number(b.sugar_g)    : null,
      sodium_mg:  b.sodium_mg  != null ? Number(b.sodium_mg)  : null,
      source:     safeStr(b.source || 'manual', 20),
      notes:      b.notes      ? safeStr(b.notes, 500)      : null,
      ai_analysis:b.ai_analysis ? safeStr(b.ai_analysis, 2000) : null,
    }])
    console.log(`[nutrition] Saved: ${safeStr(b.dish_name,30)} user:${userId.slice(0,8)}`)
    return res.json({ success: true, entry_id })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.log') })
  }
})

// ── GET /api/nutrition/today ──────────────────────────────────────────────────
router.get('/nutrition/today', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const today = todayStr()
    let rows: any[] = []

    // Try full query first (requires edited_at + deleted columns from ALTER TABLE)
    // Falls back to simple query if those columns don't exist yet
    try {
      const [fullRows] = await bigquery.query({
        query: `
          SELECT entry_id, log_date, meal_type, dish_name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, notes, logged_at, edited_at
          FROM (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY entry_id ORDER BY COALESCE(edited_at, logged_at) DESC) AS rn
            FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
            WHERE user_id  = @userId
              AND log_date = @today
          )
          WHERE rn = 1
            AND (deleted IS NULL OR deleted = FALSE)
          ORDER BY logged_at ASC
        `,
        params: { userId, today },
      })
      rows = fullRows as any[]
    } catch (queryErr) {
      // Fallback: edited_at / deleted columns may not exist yet — use simple query
      console.warn('[nutrition/today] Falling back to simple query:', (queryErr as Error).message?.slice(0, 100))
      const [simpleRows] = await bigquery.query({
        query: `
          SELECT entry_id, log_date, meal_type, dish_name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, notes, logged_at
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
          WHERE user_id  = @userId
            AND log_date = @today
          ORDER BY logged_at ASC
        `,
        params: { userId, today },
      })
      rows = simpleRows as any[]
    }

    const totals = rows.length === 0 ? null :
      rows.reduce((acc:any, r:any) => ({
        calories:  (acc.calories||0)  + (r.calories||0),
        protein_g: (acc.protein_g||0) + (r.protein_g||0),
        carbs_g:   (acc.carbs_g||0)   + (r.carbs_g||0),
        fat_g:     (acc.fat_g||0)     + (r.fat_g||0),
        fiber_g:   (acc.fiber_g||0)   + (r.fiber_g||0),
        sugar_g:   (acc.sugar_g||0)   + (r.sugar_g||0),
        sodium_mg: (acc.sodium_mg||0) + (r.sodium_mg||0),
      }), { calories:0, protein_g:0, carbs_g:0, fat_g:0, fiber_g:0, sugar_g:0, sodium_mg:0 })

    return res.json({ entries: rows, totals })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.today') })
  }
})

// ── GET /api/nutrition/history ────────────────────────────────────────────────
router.get('/nutrition/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const days = Math.min(Math.max(parseInt(req.query.days as string || '30'), 1), 90)

    const [rows] = await bigquery.query({
      query: `
        SELECT log_date, COUNT(*) AS meal_count,
          ROUND(SUM(IFNULL(calories,0)),1) AS total_calories,
          ROUND(SUM(IFNULL(protein_g,0)),1) AS total_protein_g,
          ROUND(SUM(IFNULL(carbs_g,0)),1)   AS total_carbs_g,
          ROUND(SUM(IFNULL(fat_g,0)),1)     AS total_fat_g,
          ROUND(SUM(IFNULL(fiber_g,0)),1)   AS total_fiber_g
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
        WHERE user_id  = @userId
          AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
        GROUP BY log_date
        ORDER BY log_date DESC
      `,
      params: { userId, days },
    })
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.history') })
  }
})


// ── PUT /api/nutrition/entry/:entry_id ───────────────────────────────────────
// Edits a logged meal. BigQuery is append-only — we insert a corrected row with
// the same entry_id + edited_at. The today query partitions by entry_id and picks
// the latest version. Old versions stay as a change log — nothing is deleted.
router.put('/nutrition/entry/:entry_id', async (req: Request, res: Response) => {
  try {
    const userId   = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })
    const entry_id = safeStr(req.params.entry_id, 100)
    if (!entry_id)  return res.status(400).json({ error: 'Missing entry_id' })
    const b = req.body
    if (!b.dish_name) return res.status(400).json({ error: 'Missing dish_name' })
    const now = BigQuery.timestamp(new Date())
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id,
      user_id:     userId,
      log_date:    safeStr(b.log_date || localDateStr(new Date()), 10),
      logged_at:   now,
      edited_at:   now,
      meal_type:   b.meal_type  ? safeStr(b.meal_type, 50)    : null,
      dish_name:   safeStr(b.dish_name, 200),
      calories:    b.calories   != null ? Number(b.calories)  : null,
      protein_g:   b.protein_g  != null ? Number(b.protein_g) : null,
      carbs_g:     b.carbs_g    != null ? Number(b.carbs_g)   : null,
      fat_g:       b.fat_g      != null ? Number(b.fat_g)     : null,
      fiber_g:     b.fiber_g    != null ? Number(b.fiber_g)   : null,
      sugar_g:     b.sugar_g    != null ? Number(b.sugar_g)   : null,
      sodium_mg:   b.sodium_mg  != null ? Number(b.sodium_mg) : null,
      source:      safeStr(b.source || 'manual', 20),
      notes:       b.notes      ? safeStr(b.notes, 500)       : null,
      ai_analysis: b.ai_analysis ? safeStr(b.ai_analysis, 2000) : null,
    }])
    return res.json({ success: true, entry_id })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.edit') })
  }
})
// ── DELETE /api/nutrition/entry/:entry_id ────────────────────────────────────
// BigQuery is append-only — we soft-delete by inserting a tombstone row with
// deleted=true and the same entry_id. The today query filters WHERE deleted != TRUE
// so the meal disappears from the UI. Original rows stay as audit trail.
router.delete('/nutrition/entry/:entry_id', async (req: Request, res: Response) => {
  try {
    const userId   = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })
    const entry_id = safeStr(req.params.entry_id, 100)
    if (!entry_id)  return res.status(400).json({ error: 'Missing entry_id' })

    const now = BigQuery.timestamp(new Date())
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id,
      user_id:     userId,
      log_date:    localDateStr(new Date()),
      logged_at:   now,
      edited_at:   now,
      deleted:     true,
      // Required NOT NULL fields — set to placeholder values for tombstone
      dish_name:   '_deleted_',
      source:      'deleted',
    }])
    console.log(`[nutrition/delete] Soft-deleted entry ${entry_id} for user:${userId.slice(0, 8)}`)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.delete') })
  }
})

// ════════════════════════════════════════════════════════════════════════
// COFFEE TRACKER
// ════════════════════════════════════════════════════════════════════════

// ── POST /api/coffee/log ──────────────────────────────────────────────────────
router.post('/coffee/log', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const b = req.body
    if (!b.coffee_type) return res.status(400).json({ error: 'Missing coffee_type' })

    const entry_id = 'cf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
    const now      = BigQuery.timestamp(new Date())

    await bigquery.dataset(BQ.DATASET).table('coffee_log').insert([{
      entry_id,
      user_id:     userId,
      logged_at:   now,
      log_date:    localDateStr(new Date()),
      coffee_type: safeStr(b.coffee_type, 50),
      roast:       b.roast       ? safeStr(b.roast, 30)        : null,
      dose_g:      b.dose_g      != null ? Number(b.dose_g)   : null,
      yield_g:     b.yield_g     != null ? Number(b.yield_g)  : null,
      notes:       b.notes       ? safeStr(b.notes, 300)       : null,
    }])

    console.log(`[coffee] Logged ${b.coffee_type} for user:${userId.slice(0, 8)}`)
    return res.json({ success: true, entry_id })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'coffee.log') })
  }
})

// ── GET /api/coffee/today ─────────────────────────────────────────────────────
router.get('/coffee/today', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [rows] = await bigquery.query({
      query: `
        SELECT entry_id, log_date, logged_at, coffee_type, roast, dose_g, yield_g, notes
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.coffee_log\`
        WHERE user_id  = @userId
          AND log_date = @today
        ORDER BY logged_at ASC
      `,
      params: { userId, today: localDateStr(new Date()) },
    })
    // Normalize BQ Timestamp objects to plain strings for the client
    const normalized = (rows as any[]).map(r => ({
      ...r,
      log_date:  parseBQDate(r.log_date),
      logged_at: r.logged_at?.value ?? r.logged_at ?? null,
    }))
    return res.json(normalized)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'coffee.today') })
  }
})

// ── GET /api/coffee/history ───────────────────────────────────────────────────
router.get('/coffee/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const days = Math.min(Math.max(parseInt(req.query.days as string || '30'), 1), 90)

    const [rows] = await bigquery.query({
      query: `
        SELECT
          log_date,
          COUNT(*) AS cups,
          STRING_AGG(DISTINCT coffee_type, ', ') AS types,
          STRING_AGG(DISTINCT roast, ', ') AS roasts
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.coffee_log\`
        WHERE user_id  = @userId
          AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
        GROUP BY log_date
        ORDER BY log_date DESC
      `,
      params: { userId, days },
    })
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'coffee.history') })
  }
})

// ════════════════════════════════════════════════════════════════════════
// MORNING CHALLENGE + WEEKLY STORY
// ════════════════════════════════════════════════════════════════════════

// ── GET /api/challenge ────────────────────────────────────────────────────────
// Generates a personalised morning challenge + evidence-based suggestion.
// Reads 30d of BigQuery data, picks the most relevant weak spot, then pairs it
// with an interesting technique from behavioral science / sleep research / health.
// Response is cached on the client per day — Claude only called once per day.
router.get('/challenge', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI not configured' })

    const [logs] = await bigquery.query({
      query: `
        SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
          work_done, future_done, body_done, work_task, future_task, body_task, reflection
        FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.daily_log\`
          WHERE user_id  = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        )
        WHERE rn = 1
        ORDER BY log_date DESC
      `,
      params: { userId },
    })

    const rows = logs as any[]
    if (rows.length < 3) {
      return res.json({
        category:    'Getting started',
        icon:        '🌱',
        observation: 'You need a few more days of data before I can spot your patterns.',
        challenge:   'Log morning + evening for the next 3 days to unlock personalised challenges.',
        science:     'Tracking itself changes behaviour — the act of observation increases follow-through by 40% (Gollwitzer & Sheeran, 2006).',
        source:      'Gollwitzer & Sheeran, Psychological Bulletin 2006',
        difficulty:  'easy',
      })
    }

    const wins    = rows.filter(r => r.day_outcome === 'win').length
    const logged  = rows.filter(r => r.day_outcome).length
    const winRate = logged > 0 ? Math.round((wins / logged) * 100) : 0

    const bodyDone    = rows.filter(r => r.body_done).length
    const futureDone  = rows.filter(r => r.future_done).length
    const workDone    = rows.filter(r => r.work_done).length
    const bodyRate    = logged > 0 ? Math.round((bodyDone  / logged) * 100) : 0
    const futureRate  = logged > 0 ? Math.round((futureDone / logged) * 100) : 0
    const workRate    = logged > 0 ? Math.round((workDone   / logged) * 100) : 0

    const avgEnergy = rows.filter(r=>r.energy_level).reduce((s:number,r:any)=>s+r.energy_level,0) / Math.max(rows.filter(r=>r.energy_level).length,1)
    const avgFocus  = rows.filter(r=>r.focus_level).reduce((s:number,r:any)=>s+r.focus_level,0)   / Math.max(rows.filter(r=>r.focus_level).length,1)
    const avgMood   = rows.filter(r=>r.mood_level).reduce((s:number,r:any)=>s+r.mood_level,0)     / Math.max(rows.filter(r=>r.mood_level).length,1)

    // Build dataContext — no nested backticks
    const recentDays = rows.slice(0, 7).map(r => {
      const d   = parseBQDate(r.log_date)
      const out = r.day_outcome?.toUpperCase() || 'no outcome'
      return d + ': ' + out + ' energy=' + (r.energy_level || '?') + ' body_done=' + r.body_done
    }).join('\n')

    const dataContext =
      'USER DATA (last ' + rows.length + ' days):\n' +
      'Win rate: ' + winRate + '%\n' +
      'Body habit done: ' + bodyRate + '% | Future goal done: ' + futureRate + '% | Work habit done: ' + workRate + '%\n' +
      'Avg energy: ' + avgEnergy.toFixed(1) + '/10 | Avg focus: ' + avgFocus.toFixed(1) + '/10 | Avg mood: ' + avgMood.toFixed(1) + '/10\n' +
      '\nRECENT DAYS:\n' + recentDays

    // Build prompt — no backticks, avoids nesting issues
    const prompt =
      'You are a performance coach and evidence-based health researcher. You have the user data below.\n\n' +
      'Your task: Generate ONE morning challenge card. It must do two things at once:\n' +
      '1. Be grounded in the user actual data — identify the most relevant weak spot or opportunity\n' +
      '2. Introduce something INTERESTING and SURPRISING — a technique from behavioral science, sleep research, nutrition, or performance psychology. Something that makes them think: oh that is interesting, I should try this.\n\n' +
      'Rules:\n' +
      '- Do NOT give generic advice like sleep more or drink water\n' +
      '- The technique must be specific and actionable TODAY or THIS WEEK\n' +
      '- Reference a real study, researcher, or source (e.g. Huberman Lab, Gollwitzer 2006)\n' +
      '- Connect it to their actual numbers — mention their specific % or score\n' +
      '- Tone: curious mentor, not a coach barking orders\n\n' +
      dataContext + '\n\n' +
      'Respond ONLY with JSON, no preamble:\n' +
      '{\n' +
      '  \"category\": \"one of: Body, Focus, Sleep, Nutrition, Mindset, Habit, Energy, Recovery\",\n' +
      '  \"icon\": \"single emoji\",\n' +
      '  \"observation\": \"One sentence about what the user data shows — use their real numbers\",\n' +
      '  \"challenge\": \"The specific interesting thing to try today or this week — 2-3 sentences. Be specific and surprising.\",\n' +
      '  \"science\": \"The evidence or mechanism behind it — 1-2 sentences. Name the study/researcher/source.\",\n' +
      '  \"source\": \"short citation e.g. Huberman Lab 2023\",\n' +
      '  \"difficulty\": \"one of: easy, medium, hard\"\n' +
      '}'

    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 30_000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
    }).finally(() => clearTimeout(timeout))

    if (!anthropicRes.ok) {
      console.error('[challenge] Anthropic error:', anthropicRes.status)
      return res.status(502).json({ error: 'AI unavailable' })
    }

    const data  = await anthropicRes.json() as any
    const raw   = data.content?.[0]?.text ?? '{}'
    let result: any
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
      result = JSON.parse(start !== -1 && end > start ? clean.slice(start, end + 1) : clean)
    } catch {
      return res.status(502).json({ error: 'Could not parse challenge data' })
    }

    return res.json(result)
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'challenge')
    return res.status(500).json({ error: msg })
  }
})

// ── GET /api/weekly-story ─────────────────────────────────────────────────────
// Generates a narrative weekly summary. Intended for Sunday mornings.
// Claude reads the past 7 days and writes a short story with score, key pattern,
// and one focus for next week. Response is cached on the client per week.
router.get('/weekly-story', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI not configured' })

    // Last 7 days
    const [logs] = await bigquery.query({
      query: `
        SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
          work_done, future_done, body_done, work_task, future_task, body_task,
          tomorrow_action, reflection
        FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.daily_log\`
          WHERE user_id  = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        )
        WHERE rn = 1
        ORDER BY log_date ASC
      `,
      params: { userId },
    })

    const rows = logs as any[]
    if (rows.length < 4) {
      return res.json({
        headline:  'Keep logging to unlock your weekly story',
        story:     'You need at least 4 days of logs this week before I can write your story. Come back after a few more days.',
        score:     null,
        pattern:   null,
        next_week: 'Log every morning + evening this week.',
        stats:     {},
      })
    }

    const wins      = rows.filter(r => r.day_outcome === 'win').length
    const partials  = rows.filter(r => r.day_outcome === 'partial').length
    const misses    = rows.filter(r => r.day_outcome === 'miss').length
    const logged    = rows.filter(r => r.day_outcome).length
    const winRate   = logged > 0 ? Math.round((wins / logged) * 100) : 0
    const avg = (key: string) => {
      const vals = rows.filter(r => r[key]).map(r => r[key])
      return vals.length ? (vals.reduce((a:number,b:number)=>a+b,0)/vals.length).toFixed(1) : '?'
    }
    const bodyOnWinDays = rows.filter(r => r.day_outcome === 'win' && r.body_done).length
    const bodyWinCorr   = wins > 0 ? Math.round((bodyOnWinDays / wins) * 100) : 0

    const dayLines = rows.map(r => {
      const d = parseBQDate(r.log_date)
      const dow = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
      const out = r.day_outcome?.toUpperCase() || 'not closed'
      const work = safeStr(r.work_task || '?', 40)
      return d + ' (' + dow + '): ' + out +
        ' | energy=' + (r.energy_level || '?') +
        ' focus='    + (r.focus_level  || '?') +
        ' mood='     + (r.mood_level   || '?') +
        ' | body='   + (r.body_done   ? 'done' : 'skip') +
        ' future='   + (r.future_done ? 'done' : 'skip') +
        ' | work="'  + work + '"'
    }).join('\n')

    const reflections = rows.filter(r => r.reflection).map(r => '"' + safeStr(r.reflection, 150) + '"').join(' | ') || 'None written'

    // Weekly story prompt — concatenation only, no nested backticks
    const avgEl = avg('energy_level')
    const avgFl = avg('focus_level')
    const avgMl = avg('mood_level')
    const prompt =
      'You are a performance coach writing a weekly review for DECODE, a personal productivity app.\n\n' +
      'The user tracked habits and mood every day this week. Write their weekly story honestly and specifically.\n\n' +
      'WEEK DATA:\n' +
      'Days logged: ' + rows.length + '\n' +
      'WIN/PARTIAL/MISS: ' + wins + '/' + partials + '/' + misses + '  Win rate: ' + winRate + '%\n' +
      'Avg energy: ' + avgEl + '/10  focus: ' + avgFl + '/10  mood: ' + avgMl + '/10\n' +
      'Body habit done on WIN days: ' + bodyWinCorr + '%\n\n' +
      'DAILY BREAKDOWN:\n' + dayLines + '\n\n' +
      'REFLECTIONS:\n' + reflections + '\n\n' +
      'Respond ONLY with JSON, no preamble. Use this exact structure:\n' +
      '{"headline":"one sentence","story":"3-4 sentence narrative","score":5,"pattern":"key pattern","next_week":"focus","stats":{"win_rate":"' + winRate + '%","avg_energy":"' + avgEl + '","avg_focus":"' + avgFl + '","avg_mood":"' + avgMl + '"}}'

    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 30_000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    }).finally(() => clearTimeout(timeout))

    if (!anthropicRes.ok) {
      console.error('[weekly-story] Anthropic error:', anthropicRes.status)
      return res.status(502).json({ error: 'AI unavailable' })
    }

    const data  = await anthropicRes.json() as any
    const raw   = data.content?.[0]?.text ?? '{}'
    let result: any
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
      result = JSON.parse(start !== -1 && end > start ? clean.slice(start, end + 1) : clean)
    } catch {
      return res.status(502).json({ error: 'Could not parse story data' })
    }

    return res.json({ ...result, days_logged: rows.length, win_rate: winRate })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'weekly-story')
    return res.status(500).json({ error: msg })
  }
})

// ════════════════════════════════════════════════════════════════════════
// PRESENCE — online status + friends list
// ════════════════════════════════════════════════════════════════════════

// ── POST /api/heartbeat ───────────────────────────────────────────────────────
// Called every 60s by the client while the app is open.
// Updates (or inserts) the user's last_seen timestamp in user_presence.
// Uses MERGE so it's idempotent — safe to call many times.
router.post('/heartbeat', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const displayName = req.body?.display_name ? safeStr(req.body.display_name, 60) : null
    const now         = BigQuery.timestamp(new Date())

    // Use streaming insert for heartbeat — fast and avoids MERGE DML complexity.
    // We delete the old row first, then insert the updated one.
    // user_presence is tiny so this is safe and fast.
    try {
      await bigquery.query({
        query: `
          DELETE FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_presence\`
          WHERE user_id = @userId
        `,
        params: { userId },
      })
    } catch (_) { /* ignore if row doesn't exist yet */ }

    await bigquery.dataset(BQ.DATASET).table('user_presence').insert([{
      user_id:      userId,
      display_name: displayName,
      last_seen:    now,
      app_version:  '1.0',
    }])

    return res.json({ ok: true })
  } catch (err) {
    // Heartbeat failure is non-critical — return ok anyway so client doesn't show errors
    console.error('[heartbeat] error:', (err as Error).message?.slice(0, 100))
    return res.json({ ok: true })
  }
})

// ── GET /api/users/presence ───────────────────────────────────────────────────
// Returns all users with a display_name who have been seen in the last 24 hours,
// plus their today's outcome if they logged today.
// Online = last_seen within 3 min | Recent = within 30 min | Away = today | Offline
router.get('/users/presence', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const today = localDateStr(new Date())

    const [rows] = await bigquery.query({
      query: `
        SELECT
          p.user_id,
          p.display_name,
          p.last_seen,
          l.day_outcome,
          l.energy_level,
          -- Online status tiers based on last_seen
          CASE
            WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), p.last_seen, MINUTE) <= 3   THEN 'online'
            WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), p.last_seen, MINUTE) <= 30  THEN 'recent'
            WHEN DATE(p.last_seen) = @today                                       THEN 'away'
            ELSE 'offline'
          END AS status
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_presence\` p
        LEFT JOIN (
          SELECT user_id, day_outcome, energy_level
          FROM (
            SELECT user_id, day_outcome, energy_level,
              ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY submitted_at DESC) AS rn
            FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
            WHERE log_date = @today
          )
          WHERE rn = 1
        ) l ON l.user_id = p.user_id
        WHERE p.display_name IS NOT NULL
          AND p.display_name != ''
          AND DATE(p.last_seen) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        ORDER BY
          CASE WHEN p.user_id = @userId THEN 0 ELSE 1 END,  -- current user first
          p.last_seen DESC
      `,
      params: { userId, today },
    })

    // Normalize timestamps
    const users = (rows as any[]).map(r => ({
      user_id:      r.user_id,
      display_name: r.display_name,
      last_seen:    r.last_seen?.value ?? r.last_seen ?? null,
      day_outcome:  r.day_outcome ?? null,
      energy_level: r.energy_level ?? null,
      status:       r.status,
      is_me:        r.user_id === userId,
    }))

    return res.json(users)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'users.presence') })
  }
})

export default router