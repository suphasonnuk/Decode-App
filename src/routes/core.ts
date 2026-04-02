import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import type { LogPayload }          from '../types'
import {
  localDateStr, todayStr, yesterdayStr, weekStartStr, parseBQDate,
  safeStr, safeErr, getUserId, clampLevel,
} from '../route-utils'
import { BigQuery } from '@google-cloud/bigquery'

const router = Router()

const REQUIRED_FIELDS: (keyof LogPayload)[] = [
  'log_date', 'work_task', 'future_task', 'body_task', 'energy_level',
]

// ── POST /log ─────────────────────────────────────────────────────────────
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.log_date))) {
      return res.status(400).json({ error: 'Invalid log_date format — expected YYYY-MM-DD' })
    }

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
      emotions:        payload.emotions        ? safeStr(payload.emotions, 200) : null,
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

// ── GET /week ─────────────────────────────────────────────────────────────
router.get('/week', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const start = safeStr(req.query.start as string || weekStartStr(), 10)
    const end   = localDateStr(new Date(new Date(start + 'T12:00:00').getTime() + 6 * 86400000))

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
    return res.json((rows as any[]).map(r => ({ ...r, log_date: parseBQDate(r.log_date) })))
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'week') })
  }
})

// ── GET /today ────────────────────────────────────────────────────────────
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

// ── GET /yesterday ────────────────────────────────────────────────────────
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

// ── GET /anchors/week ─────────────────────────────────────────────────────
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

// ── GET /streak ───────────────────────────────────────────────────────────
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

    let current = 0, longest30 = 0, currentRun = 0
    let currentDone = false
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

    let loginStreak = 0
    const rowDates = new Set(rows.map((r: any) => parseBQDate(r.log_date)))

    const checkDate = new Date()
    for (let i = 0; i < 90; i++) {
      const dateStr = localDateStr(checkDate)
      if (rowDates.has(dateStr)) {
        loginStreak++
      } else if (i === 0) {
        // Today has no log yet — don't break, just skip today
      } else {
        break
      }
      checkDate.setDate(checkDate.getDate() - 1)
    }

    return res.json({ current, longest30, login_streak: loginStreak })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'streak') })
  }
})

// ── GET /trends ───────────────────────────────────────────────────────────
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

// ── GET /history ──────────────────────────────────────────────────────────
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

// ── GET /profile/:user_id ─────────────────────────────────────────────────
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

// ── POST /profile ─────────────────────────────────────────────────────────
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const b   = req.body
    const now = BigQuery.timestamp(new Date())

    if (b.birth_year != null) {
      const year = Number(b.birth_year)
      if (isNaN(year) || year < 1920 || year > new Date().getFullYear() - 10) {
        return res.status(400).json({ error: 'Invalid birth year' })
      }
    }

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
      height_cm:               b.height_cm               != null ? Number(b.height_cm)               : null,
      weight_kg:               b.weight_kg               != null ? Number(b.weight_kg)               : null,
      exercise_days_per_week:  b.exercise_days_per_week  != null ? Number(b.exercise_days_per_week)  : null,
      fitness_goal:            b.fitness_goal             ? safeStr(b.fitness_goal, 50)               : null,
      profile_image: (() => {
        if (!b.profile_image || typeof b.profile_image !== 'string') return null
        if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]/.test(b.profile_image)) return null
        if (b.profile_image.length > 200000) return null
        return b.profile_image
      })(),
      created_at:              now,
      updated_at:              now,
    }
    await bigquery.dataset(BQ.DATASET).table('user_profile').insert([row])
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'profile.post') })
  }
})

export default router
