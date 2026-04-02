import { Request, Response, NextFunction } from 'express'
import { timingSafeEqual, createHash }      from 'crypto'
import { BigQuery }                          from '@google-cloud/bigquery'

// ── Date helpers ──────────────────────────────────────────────────────────────
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export function todayStr():     string { return localDateStr(new Date()) }
export function yesterdayStr(): string { const d = new Date(); d.setDate(d.getDate()-1); return localDateStr(d) }
export function weekStartStr(): string { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return localDateStr(d) }
export function parseBQDate(val: unknown): string {
  if (val && typeof val === 'object' && 'value' in (val as object)) return (val as {value:string}).value
  return val as string
}

// ── Safe input sanitizer ───────────────────────────────────────────────────
export function safeStr(val: unknown, maxLen = 500): string {
  if (!val) return ''
  return String(val).slice(0, maxLen).replace(/[`'";\\]/g, '')
}

// ── Safe error — never leak internal details to client ─────────────────────
export function safeErr(err: unknown, context: string): string {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[${context}]`, msg)
  return 'An error occurred. Please try again.'
}

// ── Rate limiter ───────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; reset: number }>()
export function rateLimit(maxReqs = 10, windowMs = 60_000) {
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
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateLimitStore) if (now > v.reset) rateLimitStore.delete(k)
}, 5 * 60_000)

// ── User ID extraction ────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function getUserId(req: Request): string | null {
  const fromHeader = req.headers['x-user-id'] as string | undefined
  const fromBody   = req.body?.user_id        as string | undefined
  const fromQuery  = req.query.user_id        as string | undefined
  const raw = (fromHeader || fromBody || fromQuery || '').trim()
  if (!raw) return null
  if (!UUID_RE.test(raw)) return null
  return raw
}

// ── Clamp level (1-10) ────────────────────────────────────────────────────
export function clampLevel(val: unknown): number | null {
  if (val == null) return null
  const n = Number(val)
  if (isNaN(n)) return null
  return Math.max(1, Math.min(10, Math.round(n)))
}

// ── Auth middleware ────────────────────────────────────────────────────────
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.APP_SECRET
  if (!secret) { next(); return }

  const token = String(req.headers['x-app-token'] || '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const a = Buffer.from(createHash('sha256').update(token).digest('hex'))
    const b = Buffer.from(createHash('sha256').update(secret).digest('hex'))
    if (!timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' })
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Re-export BigQuery for routes that need timestamp creation
export { BigQuery }
