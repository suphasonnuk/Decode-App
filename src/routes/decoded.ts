import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import { parseBQDate, safeStr, safeErr, rateLimit, getUserId } from '../route-utils'

const router = Router()

// ── GET /decoded ──────────────────────────────────────────────────────────
router.get('/decoded', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const [logRows] = await bigquery.query({
      query: `
        SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
          work_task, future_task, body_task, work_done, future_done, body_done,
          emotions, reflection, tomorrow_action
        FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
          WHERE user_id = @userId
            AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        )
        WHERE rn = 1
        ORDER BY log_date ASC
      `,
      params: { userId },
    })

    const rows = logRows as any[]

    if (rows.length < 5) {
      return res.json({
        ready: false,
        message: 'Keep logging for a few more days — you need at least 5 days of data for insights.',
        days_logged: rows.length,
      })
    }

    const completedRows = rows.filter(r => r.day_outcome)
    const wins = completedRows.filter(r => r.day_outcome === 'win')

    const avg = (arr: any[], key: string): number => {
      const vals = arr.map(r => r[key]).filter((v: any) => typeof v === 'number' && v > 0)
      return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : 0
    }

    // 1. Task completion vs mood/energy correlations
    const taskCorrelations: { label: string; insight: string; strength: number }[] = []

    for (const [_taskKey, doneKey, pillar] of [
      ['work_task', 'work_done', 'Work'],
      ['future_task', 'future_done', 'Future'],
      ['body_task', 'body_done', 'Body'],
    ] as const) {
      const doneRows = completedRows.filter(r => r[doneKey])
      const notDoneRows = completedRows.filter(r => !r[doneKey])
      if (doneRows.length >= 3 && notDoneRows.length >= 2) {
        const moodDone = avg(doneRows, 'mood_level')
        const moodNotDone = avg(notDoneRows, 'mood_level')
        const diff = Math.round((moodDone - moodNotDone) * 10) / 10
        if (Math.abs(diff) >= 0.5 && moodNotDone > 0) {
          const pct = Math.round(Math.abs(diff / moodNotDone) * 100)
          taskCorrelations.push({
            label: `${pillar} task → Mood`,
            insight: diff > 0
              ? `Your mood is ${pct}% higher on days you complete your ${pillar.toLowerCase()} task (${moodDone} vs ${moodNotDone})`
              : `Skipping ${pillar.toLowerCase()} tasks doesn't hurt your mood much — focus elsewhere`,
            strength: Math.min(Math.abs(diff) / 3, 1),
          })
        }

        const energyDone = avg(doneRows, 'energy_level')
        const energyNotDone = avg(notDoneRows, 'energy_level')
        const eDiff = Math.round((energyDone - energyNotDone) * 10) / 10
        if (Math.abs(eDiff) >= 0.5 && energyNotDone > 0) {
          const pct = Math.round(Math.abs(eDiff / energyNotDone) * 100)
          taskCorrelations.push({
            label: `${pillar} task → Energy`,
            insight: eDiff > 0
              ? `Your energy is ${pct}% higher on days you complete your ${pillar.toLowerCase()} task`
              : `Interestingly, your energy is ${pct}% higher on days you skip ${pillar.toLowerCase()} tasks`,
            strength: Math.min(Math.abs(eDiff) / 3, 1),
          })
        }
      }
    }

    // 2. Day-of-week patterns
    const dayOfWeekStats: { day: string; winRate: number; avgMood: number; avgEnergy: number; count: number }[] = []
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (let d = 0; d < 7; d++) {
      const dayRows = completedRows.filter(r => {
        const date = parseBQDate(r.log_date)
        return new Date(date + 'T12:00:00').getDay() === d
      })
      if (dayRows.length >= 2) {
        const dayWins = dayRows.filter(r => r.day_outcome === 'win').length
        dayOfWeekStats.push({
          day: DAYS[d]!,
          winRate: Math.round((dayWins / dayRows.length) * 100),
          avgMood: avg(dayRows, 'mood_level'),
          avgEnergy: avg(dayRows, 'energy_level'),
          count: dayRows.length,
        })
      }
    }

    const bestDay = dayOfWeekStats.length > 0
      ? dayOfWeekStats.reduce((best, d) => d.winRate > best.winRate ? d : best)
      : undefined
    const worstDay = dayOfWeekStats.length > 0
      ? dayOfWeekStats.reduce((worst, d) => d.winRate < worst.winRate ? d : worst)
      : undefined

    // 3. Emotion patterns
    const emotionCounts: Record<string, number> = {}
    const emotionOnWin: Record<string, number> = {}
    const emotionOnMiss: Record<string, number> = {}
    let totalEmotionDays = 0

    for (const row of completedRows) {
      if (!row.emotions) continue
      const ems = String(row.emotions).split(',').filter(Boolean)
      totalEmotionDays++
      for (const e of ems) {
        emotionCounts[e] = (emotionCounts[e] || 0) + 1
        if (row.day_outcome === 'win') emotionOnWin[e] = (emotionOnWin[e] || 0) + 1
        if (row.day_outcome === 'miss') emotionOnMiss[e] = (emotionOnMiss[e] || 0) + 1
      }
    }

    const topEmotions = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([id, count]) => ({
        emotion: id,
        count,
        pct: Math.round((count / Math.max(totalEmotionDays, 1)) * 100),
        winCorrelation: emotionOnWin[id] ? Math.round((emotionOnWin[id] / count) * 100) : 0,
      }))

    // 4. Energy → outcome correlation
    const highEnergyDays = completedRows.filter(r => r.energy_level >= 7)
    const lowEnergyDays = completedRows.filter(r => r.energy_level <= 4)
    const highEnergyWinRate = highEnergyDays.length >= 2
      ? Math.round((highEnergyDays.filter(r => r.day_outcome === 'win').length / highEnergyDays.length) * 100) : null
    const lowEnergyWinRate = lowEnergyDays.length >= 2
      ? Math.round((lowEnergyDays.filter(r => r.day_outcome === 'win').length / lowEnergyDays.length) * 100) : null

    // 5. Behavioral fingerprint
    const allTasksDoneRate = completedRows.length > 0
      ? Math.round((completedRows.filter(r => r.work_done && r.future_done && r.body_done).length / completedRows.length) * 100) : 0
    const reflectionRate = completedRows.length > 0
      ? Math.round((completedRows.filter(r => r.reflection).length / completedRows.length) * 100) : 0

    // 6. Build decoded insights
    const insights: string[] = []

    if (highEnergyWinRate !== null && lowEnergyWinRate !== null && highEnergyWinRate - lowEnergyWinRate >= 20) {
      insights.push(`When your morning energy is 7+, you WIN ${highEnergyWinRate}% of the time (vs ${lowEnergyWinRate}% on low-energy days). Energy is your strongest predictor.`)
    }

    if (bestDay && worstDay && bestDay.day !== worstDay.day && bestDay.winRate - worstDay.winRate >= 20) {
      insights.push(`${bestDay.day} is your best day (${bestDay.winRate}% win rate). ${worstDay.day} is your weakest (${worstDay.winRate}%). What's different about these days?`)
    }

    const bodyDoneRows = completedRows.filter(r => r.body_done)
    const bodySkipRows = completedRows.filter(r => !r.body_done)
    if (bodyDoneRows.length >= 3 && bodySkipRows.length >= 2) {
      const bodyMood = avg(bodyDoneRows, 'mood_level')
      const noBodyMood = avg(bodySkipRows, 'mood_level')
      if (bodyMood - noBodyMood >= 0.8) {
        insights.push(`Your body habit is your mood anchor — mood is ${bodyMood} when you do it vs ${noBodyMood} when you skip. Never skip it.`)
      }
    }

    if (reflectionRate > 0 && reflectionRate < 50) {
      insights.push(`You only reflect ${reflectionRate}% of days. The days you reflect tend to have deeper self-awareness. Try making it a non-negotiable.`)
    }

    if (topEmotions.length >= 3) {
      const top3 = topEmotions.slice(0, 3).map(e => e.emotion)
      insights.push(`Your most frequent emotional state: ${top3.join(', ')}. This is your baseline — notice when you deviate from it.`)
    }

    const winEmotions = Object.entries(emotionOnWin).sort(([, a], [, b]) => b - a).slice(0, 2).map(([e]) => e)
    const missEmotions = Object.entries(emotionOnMiss).sort(([, a], [, b]) => b - a).slice(0, 2).map(([e]) => e)
    if (winEmotions.length > 0 && missEmotions.length > 0) {
      insights.push(`On WIN days you tend to feel: ${winEmotions.join(', ')}. On MISS days: ${missEmotions.join(', ')}. Your emotions predict your outcomes.`)
    }

    return res.json({
      ready: true,
      days_logged: rows.length,
      days_completed: completedRows.length,
      overview: {
        win_rate: completedRows.length > 0 ? Math.round((wins.length / completedRows.length) * 100) : 0,
        avg_energy: avg(completedRows, 'energy_level'),
        avg_focus: avg(completedRows, 'focus_level'),
        avg_mood: avg(completedRows, 'mood_level'),
        all_tasks_done_rate: allTasksDoneRate,
        reflection_rate: reflectionRate,
      },
      correlations: taskCorrelations.sort((a, b) => b.strength - a.strength).slice(0, 6),
      day_of_week: dayOfWeekStats,
      best_day: bestDay ? { day: bestDay.day, win_rate: bestDay.winRate } : null,
      worst_day: worstDay ? { day: worstDay.day, win_rate: worstDay.winRate } : null,
      emotions: {
        total_days_with_emotions: totalEmotionDays,
        top_emotions: topEmotions,
        win_emotions: winEmotions,
        miss_emotions: missEmotions,
      },
      energy_outcome: {
        high_energy_win_rate: highEnergyWinRate,
        low_energy_win_rate: lowEnergyWinRate,
      },
      insights,
    })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'decoded') })
  }
})

// ── POST /decoded/portrait ────────────────────────────────────────────────
router.post('/decoded/portrait', rateLimit(3, 60_000), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'AI not configured' })

    const [logResult, profileResult] = await Promise.all([
      bigquery.query({
        query: `
          SELECT log_date, day_outcome, energy_level, focus_level, mood_level,
            work_task, future_task, body_task, work_done, future_done, body_done,
            emotions, reflection
          FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY log_date ORDER BY submitted_at DESC) AS rn
            FROM \`${BQ.PROJECT}.${BQ.DATASET}.${BQ.TABLE}\`
            WHERE user_id = @userId
              AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
          )
          WHERE rn = 1
          ORDER BY log_date DESC
        `,
        params: { userId },
      }),
      bigquery.query({
        query: `
          SELECT name, occupation, primary_goal, birth_year
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.user_profile\`
          WHERE user_id = @userId ORDER BY updated_at DESC LIMIT 1
        `,
        params: { userId },
      }),
    ])

    const logs = logResult[0] as any[]
    const profile = profileResult[0][0] as any ?? {}

    if (logs.length < 7) {
      return res.json({ portrait: null, message: 'Need at least 7 days of data for a self-portrait.' })
    }

    const completed = logs.filter(r => r.day_outcome)
    const winRate = completed.length > 0 ? Math.round((completed.filter(r => r.day_outcome === 'win').length / completed.length) * 100) : 0
    const pavg = (arr: any[], key: string): number => {
      const vals = arr.map(r => r[key]).filter((v: any) => typeof v === 'number' && v > 0)
      return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : 0
    }
    const avgE = pavg(completed, 'energy_level')
    const avgF = pavg(completed, 'focus_level')
    const avgM = pavg(completed, 'mood_level')

    const eCounts: Record<string, number> = {}
    for (const r of completed) {
      if (!r.emotions) continue
      for (const e of String(r.emotions).split(',')) {
        if (e) eCounts[e] = (eCounts[e] || 0) + 1
      }
    }
    const topEmos = Object.entries(eCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([e, c]) => e + '(' + c + ')').join(', ')

    const refls = logs.filter(r => r.reflection).slice(0, 8).map(r =>
      parseBQDate(r.log_date) + ': "' + safeStr(r.reflection, 150) + '"'
    ).join('\n') || 'None logged'

    const taskFreq: Record<string, number> = {}
    for (const r of logs) {
      for (const key of ['work_task', 'future_task', 'body_task']) {
        const t = r[key]
        if (t) taskFreq[t] = (taskFreq[t] || 0) + 1
      }
    }
    const topTasks = Object.entries(taskFreq).sort(([, a], [, b]) => b - a).slice(0, 5).map(([t, c]) => t + ' (' + c + 'x)').join(', ')

    const dataBlock =
      'PROFILE: ' + (profile.name || 'Anonymous') + ', ' + (profile.occupation || 'unknown role') + ', goal: ' + (profile.primary_goal || 'unspecified') + '\n' +
      'DATA: ' + logs.length + ' days logged, ' + completed.length + ' completed\n' +
      'WIN RATE: ' + winRate + '%  |  AVG energy: ' + avgE + '  focus: ' + avgF + '  mood: ' + avgM + '\n' +
      'TOP EMOTIONS: ' + (topEmos || 'Not tracked yet') + '\n' +
      'TOP TASKS: ' + topTasks + '\n' +
      'REFLECTIONS:\n' + refls

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1200, temperature: 0.7,
        messages: [{ role: 'user', content:
          '=== CONTEXT ===\n' +
          'You are a psychologist and self-awareness coach analyzing behavioral data from the DECODE personal tracking app.\n' +
          'The user logs daily tasks (work, future goals, body habits), energy/focus/mood (1-10), emotions, reflections, and day outcomes.\n\n' +
          '=== DATA ===\n' + dataBlock + '\n\n' +
          '=== TASK ===\n' +
          'Write a "decoded self-portrait" — a honest, insightful analysis of who this person is based on their data.\n' +
          'This should feel like looking in a mirror they have never seen before.\n\n' +
          'Return valid JSON only:\n' +
          '{\n' +
          '  "title": "A 3-5 word title for their portrait (e.g. The Restless Builder, The Quiet Achiever)",\n' +
          '  "portrait": "2-3 paragraphs. Start with who they ARE, not what they do. Describe their patterns, tendencies, contradictions. What drives them? What do they avoid? What pattern are they blind to? Be specific — use their actual data. Be warm but honest. This should feel like someone finally seeing them clearly.",\n' +
          '  "blind_spot": "One specific blind spot — something their data reveals that they probably don\'t consciously see about themselves.",\n' +
          '  "strength": "One core strength that their data consistently shows.",\n' +
          '  "question": "One question for them to sit with — something their data raises that only they can answer."\n' +
          '}'
        }],
      }),
    }).finally(() => clearTimeout(timeout))

    if (!anthropicRes.ok) {
      return res.status(502).json({ error: 'AI unavailable' })
    }

    const data = await anthropicRes.json() as any
    const raw = data.content?.[0]?.text ?? '{}'
    let portrait: any
    try { portrait = JSON.parse(raw.replace(/```json|```/g, '').trim()) }
    catch { return res.status(502).json({ error: 'AI returned invalid response — try again' }) }
    return res.json({ portrait, days_analyzed: logs.length })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Request timed out' : safeErr(err, 'decoded.portrait')
    return res.status(500).json({ error: msg })
  }
})

export default router
