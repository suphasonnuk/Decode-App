import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import { parseBQDate, safeStr, safeErr, rateLimit, getUserId, todayStr } from '../route-utils'
import { getCached, setCache } from './ai-cache'

const router = Router()

// ── POST /coach ───────────────────────────────────────────────────────────
router.post('/coach', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    // Check server-side cache first (survives localStorage clears + works across devices)
    const today = todayStr()
    const cached = await getCached(userId, 'coach', today)
    if (cached) return res.json(cached)

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI coach not configured' })

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

    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 30_000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1000,
        messages: [{ role: 'user', content: `=== CONTEXT ===\nThis is a performance coaching session for the DECODE personal productivity and health tracking app.\nThe user logs every day: 3 tasks (work, future goal, body habit), energy (1-10), focus (1-10), mood (1-10), and a day outcome (WIN/PARTIAL/MISS).\nThe user's primary goal: ${profile.primary_goal || 'Not specified — coach broadly across work, future, and body pillars'}.\n\n=== YOUR ROLE ===\nYou are a world-class performance coach for the DECODE system (Direction · Execute · Close · Observe · Develop · Evolve). Direct, warm, data-driven.\n\n=== THEIR DATA ===\n${dataContext}\n\n=== TASK ===\nWrite coaching in valid JSON only, no preamble:\n{"greeting":"...","summary":"...","patterns":["...","...","..."],"action":"...","score":7}` }],
      }),
    }).finally(() => clearTimeout(timeout))

    if (!anthropicRes.ok) {
      console.error('[coach] Anthropic error:', anthropicRes.status)
      return res.status(502).json({ error: 'AI coach unavailable' })
    }

    const data     = await anthropicRes.json() as any
    const raw      = data.content?.[0]?.text ?? '{}'
    let coaching: any
    try { coaching = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
    catch { return res.status(502).json({ error: 'AI returned invalid response — try again' }) }
    const result = { ...coaching, data_points: rows.length, win_rate: winRate }
    setCache(userId, 'coach', today, result)
    return res.json(result)
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'coach')
    return res.status(500).json({ error: msg })
  }
})

export default router
