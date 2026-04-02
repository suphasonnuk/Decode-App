import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import { localDateStr, safeStr, safeErr, rateLimit, getUserId } from '../route-utils'
import { BigQuery } from '@google-cloud/bigquery'

const router = Router()

// ── POST /heartbeat ───────────────────────────────────────────────────────
router.post('/heartbeat', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const displayName = req.body?.display_name ? safeStr(req.body.display_name, 60) : null
    const now         = BigQuery.timestamp(new Date())

    try {
      await bigquery.query({
        query: `
          DELETE FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_presence\`
          WHERE user_id = @userId
        `,
        params: { userId },
      })
    } catch (_) { /* ignore if row doesn't exist yet */ }

    try {
      await bigquery.dataset(BQ.DATASET).table('user_presence').insert([{
        user_id:      userId,
        display_name: displayName,
        last_seen:    now,
        app_version:  '1.0',
      }])
    } catch (insertErr) {
      console.warn('[heartbeat] insert failed, will retry next cycle:', (insertErr as Error).message?.slice(0, 80))
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('[heartbeat] error:', (err as Error).message?.slice(0, 100))
    return res.json({ ok: true })
  }
})

// ── GET /users/presence ───────────────────────────────────────────────────
router.get('/users/presence', rateLimit(30, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const today = localDateStr(new Date())

    const baseQuery = `
        SELECT
          p.user_id,
          p.display_name,
          p.last_seen,
          l.day_outcome,
          l.energy_level,
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
          CASE WHEN p.user_id = @userId THEN 0 ELSE 1 END,
          p.last_seen DESC`

    let rows: any[]
    try {
      const [r] = await bigquery.query({
        query: `
          SELECT base.*, prof.profile_image
          FROM (${baseQuery}) base
          LEFT JOIN (
            SELECT user_id, profile_image
            FROM (
              SELECT user_id, profile_image,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
              FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_profile\`
            )
            WHERE rn = 1
          ) prof ON prof.user_id = base.user_id
        `,
        params: { userId, today },
      })
      rows = r as any[]
    } catch (_) {
      const [r] = await bigquery.query({ query: baseQuery, params: { userId, today } })
      rows = r as any[]
    }

    const users = rows.map(r => ({
      user_id:       r.user_id,
      display_name:  r.display_name,
      last_seen:     r.last_seen?.value ?? r.last_seen ?? null,
      day_outcome:   r.day_outcome ?? null,
      energy_level:  r.energy_level ?? null,
      status:        r.status,
      is_me:         r.user_id === userId,
      profile_image: r.profile_image ?? null,
    }))

    return res.json(users)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'users.presence') })
  }
})

export default router
