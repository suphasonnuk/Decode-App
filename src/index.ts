import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import path    from 'path'
import router, { authMiddleware } from './routes'

const app = express()

// ── Fix 4: CORS — restrict to your Cloud Run URL ──────────────────────────────
// Set ALLOWED_ORIGIN env var to your Cloud Run URL.
// Falls back to permissive in dev (no ALLOWED_ORIGIN set).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
app.use(cors({
  origin: (origin, cb) => {
    if (!ALLOWED_ORIGIN)          return cb(null, true)   // dev: allow all
    if (!origin)                  return cb(null, true)   // same-origin / mobile requests
    if (origin === ALLOWED_ORIGIN) return cb(null, true)
    cb(new Error('CORS: origin not allowed'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-app-token', 'x-user-id'],
  credentials: false,
}))

app.use(express.json({ limit: '12mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ── Request timeout — 60s for all routes ──────────────────────────────────────
app.use((_req, res, next) => {
  res.setTimeout(60_000, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timed out' })
    }
  })
  next()
})

// ── Fix 7: Health endpoint — strip all infra details ─────────────────────────
// Public endpoint (no auth). Returns only what the client needs:
// status and whether auth is required. No project/dataset/table names.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    auth:   !!process.env.APP_SECRET,
  })
})

// ── All other /api/* routes require auth ──────────────────────────────────────
app.use('/api', authMiddleware, router)

// ── Serve built React frontend ────────────────────────────────────────────────
const PUBLIC_DIR = path.resolve(process.cwd(), 'dist/public')
app.use(express.static(PUBLIC_DIR))
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'))
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦞 DECODE server running → http://localhost:${PORT}`)
  console.log(`   Auth    : ${process.env.APP_SECRET    ? '🔒 enabled' : '⚠️  disabled'}`)
  console.log(`   CORS    : ${ALLOWED_ORIGIN            ? ALLOWED_ORIGIN : 'open (dev)'}`)
  console.log(`   Env     : ${process.env.NODE_ENV      || 'development'}\n`)
})