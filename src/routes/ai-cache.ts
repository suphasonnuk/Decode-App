import { bigquery, BQ } from '../bigquery'
import { BigQuery } from '@google-cloud/bigquery'

/**
 * Server-side AI response cache using BigQuery.
 * Keyed by (user_id, cache_type, cache_date).
 * Table: ai_cache — created manually or auto-fails gracefully.
 *
 * This prevents re-calling Claude API when:
 * - User clears localStorage
 * - User opens the app on a different device
 * - Client cache expires but data hasn't changed
 */

const TABLE = 'ai_cache'

export type CacheType = 'coach' | 'challenge' | 'weekly_story' | 'portrait'

export async function getCached(userId: string, type: CacheType, date: string): Promise<any | null> {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT response_json
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.${TABLE}\`
        WHERE user_id    = @userId
          AND cache_type = @type
          AND cache_date = @date
        ORDER BY created_at DESC
        LIMIT 1
      `,
      params: { userId, type, date },
    })
    if ((rows as any[]).length === 0) return null
    return JSON.parse((rows as any[])[0].response_json)
  } catch {
    // Table doesn't exist yet or query failed — treat as cache miss
    return null
  }
}

export async function setCache(userId: string, type: CacheType, date: string, response: any): Promise<void> {
  try {
    await bigquery.dataset(BQ.DATASET).table(TABLE).insert([{
      user_id:       userId,
      cache_type:    type,
      cache_date:    date,
      response_json: JSON.stringify(response),
      created_at:    BigQuery.timestamp(new Date()),
    }])
  } catch (err) {
    // Non-critical — if cache write fails, next request will just re-call the API
    console.warn('[ai-cache] Write failed:', (err as Error).message?.slice(0, 80))
  }
}
