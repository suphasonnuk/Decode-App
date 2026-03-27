# DECODE Daily Direction Tracker

## Overview
Personal daily tracking app ("DECODE") with a TypeScript/Express backend and React/Vite frontend. Tracks daily goals across three pillars: Work, Future, Body. Includes nutrition tracking, coffee logging, AI coaching (Claude API), push notifications, presence/friends system, achievements, and weekly reviews.

## Architecture
- **Backend**: Express server (`src/`) with BigQuery as the database
- **Frontend**: React 18 + Vite (`client/`) with TanStack Query, Recharts, Framer Motion
- **Deployment**: Docker multi-stage build → Google Cloud Run (asia-southeast3)
- **Auth**: Shared secret via `APP_SECRET` env var, timing-safe comparison
- **User ID**: Device-scoped UUID generated client-side, stored in localStorage

## Project Structure
```
src/                    # Express backend
  index.ts              # Server entry, CORS, static file serving
  routes.ts             # All API routes (large file ~600+ lines)
  bigquery.ts           # BigQuery client setup
  types.ts              # Shared server types (LogPayload, StreakResponse, etc.)
client/
  src/
    App.tsx             # Main app shell, tab navigation, auth flow
    api.ts              # Typed API client (fetch wrappers)
    store.ts            # localStorage helpers, TDEE calculator, user profile
    types.ts            # Client types, re-exports from data/
    achievements.ts     # Achievement definitions
    lib/                # queryClient, schemas (zod), date utilities
    data/               # Static data: tasks, sliders, help text, profile options
    components/         # UI components (Today, Night, Dashboard, Coach, etc.)
  vite.config.ts        # Vite config, API proxy to :3000 in dev
```

## Key Commands
```bash
# Development
npm run dev:server          # Express with nodemon + ts-node
npm run dev:client          # Vite dev server (cd client && vite)

# Build
npm run build               # Build client + server
npm run build:client        # Vite build → dist/public
npm run build:server        # tsc → dist/server

# Production
npm start                   # node dist/server/index.js
```

## Environment Variables
- `GCP_PROJECT_ID` — required, BigQuery project
- `BQ_DATASET` — default: `decode_tracker`
- `BQ_TABLE` — default: `daily_log`
- `GCP_KEY_FILE` — local dev only, path to service account key
- `APP_SECRET` — shared auth token (omit for open dev mode)
- `ALLOWED_ORIGIN` — CORS restriction (omit for open dev)
- `ANTHROPIC_API_KEY` — for AI coaching endpoint
- `VITE_VAPID_PUBLIC_KEY` — client-side push notification key
- `PORT` — default: 3000

## Conventions
- TypeScript with relaxed tsconfig (`strict: false`, `noImplicitAny: false`)
- Server uses CommonJS modules; client uses ESM
- BigQuery parameterized queries for all user input (plus `safeStr` sanitization)
- Client state: localStorage for persistence, sessionStorage for per-session flags
- Date handling: local date strings (`YYYY-MM-DD`), Bangkok UTC+7 aware
- API routes all under `/api/*`, health endpoint is public, rest require auth
- Rate limiting on AI endpoints (10 req/min per IP)
- Zod validation in `client/src/lib/schemas.ts`
