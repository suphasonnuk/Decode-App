import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import { parseBQDate, safeStr, safeErr, rateLimit, getUserId, todayStr, weekStartStr } from '../route-utils'
import { getCached, setCache } from './ai-cache'

const router = Router()

// ── GET /challenge ────────────────────────────────────────────────────────
router.get('/challenge', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const today = todayStr()
    const cached = await getCached(userId, 'challenge', today)
    if (cached) return res.json(cached)

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

    setCache(userId, 'challenge', today, result)
    return res.json(result)
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'challenge')
    return res.status(500).json({ error: msg })
  }
})

// ── GET /weekly-story ─────────────────────────────────────────────────────
router.get('/weekly-story', rateLimit(5, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI not configured' })

    const weekStart = weekStartStr()
    const weeklyCached = await getCached(userId, 'weekly_story', weekStart)
    if (weeklyCached) return res.json(weeklyCached)

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

    const storyResult = { ...result, days_logged: rows.length, win_rate: winRate }
    setCache(userId, 'weekly_story', weekStart, storyResult)
    return res.json(storyResult)
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'weekly-story')
    return res.status(500).json({ error: msg })
  }
})

export default router
