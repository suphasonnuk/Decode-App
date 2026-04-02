import { Router, Request, Response } from 'express'
import { timingSafeEqual, createHash } from 'crypto'
import { bigquery, BQ }               from '../bigquery'
import { safeErr, getUserId }          from '../route-utils'
import { BigQuery } from '@google-cloud/bigquery'

const router = Router()

// ── POST /push/subscribe ──────────────────────────────────────────────────
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

// ── POST /push/send — Cloud Scheduler only ────────────────────────────────
router.post('/push/send', async (req: Request, res: Response) => {
  try {
    const schedulerSecret = process.env.SCHEDULER_SECRET
    if (!schedulerSecret) return res.status(503).json({ error: 'Push not configured' })
    const incoming        = String(req.headers['x-scheduler-secret'] || '')
    try {
      const a = Buffer.from(createHash('sha256').update(incoming).digest('hex'))
      const b = Buffer.from(createHash('sha256').update(schedulerSecret).digest('hex'))
      if (!timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' })
    } catch { return res.status(401).json({ error: 'Unauthorized' }) }

    const { type } = req.body
    if (!type) return res.status(400).json({ error: 'Missing type' })

    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
    const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY
    if (!VAPID_PRIVATE || !VAPID_PUBLIC) return res.status(503).json({ error: 'VAPID keys not configured' })

    const webPush  = await import('web-push')
    webPush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@decode.app', VAPID_PUBLIC, VAPID_PRIVATE)

    const col     = type === 'morning' ? 'notify_morning' : 'notify_evening'
    const payload = JSON.stringify(type === 'morning'
      ? { title: 'DECODE', body: 'Pick your 3 tasks for today', url: '/' }
      : { title: 'DECODE', body: 'Close the day — keep your streak alive', url: '/' })

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

export default router
