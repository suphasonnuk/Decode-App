import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import { localDateStr, parseBQDate, safeStr, safeErr, getUserId } from '../route-utils'
import { BigQuery } from '@google-cloud/bigquery'

const router = Router()

// ── POST /coffee/log ──────────────────────────────────────────────────────
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

// ── GET /coffee/today ─────────────────────────────────────────────────────
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

// ── GET /coffee/history ───────────────────────────────────────────────────
router.get('/coffee/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 90)

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

export default router
