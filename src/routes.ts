import { Router } from 'express'
import { authMiddleware } from './route-utils'

import coreRouter      from './routes/core'
import nutritionRouter from './routes/nutrition'
import coffeeRouter    from './routes/coffee'
import coachRouter     from './routes/coach'
import pushRouter      from './routes/push'
import presenceRouter  from './routes/presence'
import challengeRouter from './routes/challenge'
import decodedRouter   from './routes/decoded'

// Re-export for use in index.ts
export { authMiddleware }

const router = Router()

// Mount domain routers — all paths are relative (e.g. core defines /log, /week, etc.)
router.use(coreRouter)
router.use(nutritionRouter)
router.use(coffeeRouter)
router.use(coachRouter)
router.use(pushRouter)
router.use(presenceRouter)
router.use(challengeRouter)
router.use(decodedRouter)

export default router
