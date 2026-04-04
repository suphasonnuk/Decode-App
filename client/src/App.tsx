import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import type { Tab } from './types'
import type { Achievement } from './achievements'
import { getAuthToken, todayStr, getUserId } from './store'
import { isSunday } from './lib/dates'
import { api } from './api'
// Eager — always needed on first render
import Auth             from './components/Auth'
import Onboarding       from './components/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import DailyStatus  from './components/DailyStatus'
import DecodeLogo   from './components/DecodeLogo'
import { shouldShowChallengePopup } from './lib/challenge'
// Lazy — loaded on demand when tab is activated
const Dashboard        = lazy(() => import('./components/Dashboard'))
const Today            = lazy(() => import('./components/Today'))
const Review           = lazy(() => import('./components/Review'))
const More             = lazy(() => import('./components/More'))
const Night            = lazy(() => import('./components/Night'))
const Week             = lazy(() => import('./components/Week'))
const Trends           = lazy(() => import('./components/Trends'))
const Coach            = lazy(() => import('./components/Coach'))
const Help             = lazy(() => import('./components/Help'))
const Anchors          = lazy(() => import('./components/Anchors'))
const Nutrition        = lazy(() => import('./components/Nutrition'))
const Coffee           = lazy(() => import('./components/Coffee'))
const Decode           = lazy(() => import('./components/Decode'))
const DailyChecklist   = lazy(() => import('./components/DailyChecklist'))
const WeeklyReview     = lazy(() => import('./components/WeeklyReview'))
const AchievementPopup = lazy(() => import('./components/AchievementPopup'))
const ChallengePopup   = lazy(() => import('./components/ChallengePopup'))
const FriendsPanel     = lazy(() => import('./components/FriendsPanel'))
const QuickLog         = lazy(() => import('./components/QuickLog'))

type AppTab = Tab

// Bottom navigation — 4 tabs only (iOS HIG + Material Design standard)
const TABS_PRIMARY = [
  { id: 'dashboard' as AppTab, icon: '🏠', label: 'Home'    },
  { id: 'daily'     as AppTab, icon: '☀️', label: 'Today'   },
  { id: 'review'    as AppTab, icon: '🌙', label: 'Review'  },
  { id: 'more'      as AppTab, icon: '⚙️', label: 'More'    },
]


function hasSeenOnboarding():  boolean { try { return localStorage.getItem('decode_onboarded') === '1' } catch { return false } }
function markOnboardingDone(): void    { try { localStorage.setItem('decode_onboarded', '1') } catch {} }
function markChecklistSeen(): void {
  try { sessionStorage.setItem('decode_checklist_' + todayStr(), 'seen') } catch {}
}
function weekReviewKey(): string {
  // Key by week-start date so the review triggers every Sunday, not once per month
  const d = new Date()
  d.setDate(d.getDate() - d.getDay()) // back to Sunday
  const ws = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return `decode_weekly_review_${ws}`
}
function hasSeenWeeklyReview(): boolean {
  try { return localStorage.getItem(weekReviewKey()) === '1' } catch { return false }
}
function markWeeklyReviewDone(): void {
  try { localStorage.setItem(weekReviewKey(), '1') } catch {}
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0))).buffer as ArrayBuffer
}

async function requestPushPermission(userId: string) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  if (Notification.permission === 'denied') return
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return
  try {
    const reg  = await navigator.serviceWorker.ready
    const VAPID = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!VAPID) return
    const sub     = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) })
    const subJson = sub.toJSON()
    if (subJson.endpoint && subJson.keys) {
      await api.subscribePush(userId, subJson as { endpoint: string; keys: { p256dh: string; auth: string } })
    }
  } catch (err) {
    console.warn('[Push] Subscribe failed:', err)
  }
}

interface ToastState { msg: string; isErr: boolean; visible: boolean }

// ── Offline detection + pending sync count ─────────────────────────────────
function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline  = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  // Check IndexedDB for pending sync items
  useEffect(() => {
    function checkQueue() {
      try {
        const req = indexedDB.open('decode-offline', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('queue')) { db.close(); return }
          const tx    = db.transaction('queue', 'readonly')
          const count = tx.objectStore('queue').count()
          count.onsuccess = () => { setPendingCount(count.result); db.close() }
          count.onerror   = () => db.close()
        }
        req.onerror = () => {}
      } catch { /* IndexedDB not available */ }
    }
    checkQueue()
    const interval = setInterval(checkQueue, 10_000) // re-check every 10s
    return () => clearInterval(interval)
  }, [])

  return { isOffline, pendingCount }
}

function getStoredTheme(): 'light' | 'dark' {
  try { return (localStorage.getItem('decode_theme') as 'light' | 'dark') || 'light' } catch { return 'light' }
}

function AppInner() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme)
  const [authed,        setAuthed]       = useState<boolean | null>(null)
  const [needsAuth,     setNeedsAuth]    = useState(false)
  const [showOnboard,   setShowOnboard]  = useState(false)
  const [showChecklist, setShowChecklist]= useState(false)
  const [showReview,    setShowReview]   = useState(false)
  const [pendingAch,    setPendingAch]   = useState<Achievement | null>(null)
  const [showChallenge, setShowChallenge] = useState(false)
  const [showFriends,  setShowFriends]  = useState(false)
  const [tab,           setTab]          = useState<AppTab>('dashboard')
  const [serverOk,      setServerOk]     = useState<boolean | null>(null)
  const [toast,         setToast]        = useState<ToastState>({ msg: '', isErr: false, visible: false })
  const [weekKey,       setWeekKey]      = useState(0)
  const [dashKey,       setDashKey]      = useState(0)
  const [dayKey,        setDayKey]       = useState(0)   // increments at midnight, remounts daily components
  const [streakCount,   setStreakCount]  = useState<number | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const midnightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = getUserId()
  const { isOffline, pendingCount } = useOfflineStatus()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('decode_theme', theme) } catch {}
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    // Isolated async function — each await failure is handled independently,
    // never falls into a shared catch that could bypass auth.
    async function initAuth() {
      const storedToken = getAuthToken()

      // Step 1 — check if server requires auth (health is public, always reachable)
      let authRequired = true
      try {
        const r = await fetch('/api/health')
        if (r.ok) {
          const d = await r.json()
          setServerOk(true)
          authRequired = !!d.auth
        }
      } catch {
        // Server unreachable — if we have a stored token, allow cached use
        setServerOk(false)
        if (storedToken) { setAuthed(true) } else { setNeedsAuth(true); setAuthed(false) }
        return
      }

      // Step 2 — no auth required (APP_SECRET not set) → let everyone in
      if (!authRequired) {
        setAuthed(true)
        return
      }

      // Step 3 — auth required but no stored token → show auth screen
      if (!storedToken) {
        setNeedsAuth(true)
        setAuthed(false)
        return
      }

      // Step 4 — have a stored token → verify it against a protected endpoint
      // Each step is independent: a failure here never silently bypasses auth.
      try {
        const check = await fetch('/api/streak', {
          headers: { 'x-app-token': storedToken, 'x-user-id': getUserId() }
        })
        if (check.status === 401) {
          // Token wrong or expired — clear it and force re-auth
          setNeedsAuth(true)
          setAuthed(false)
        } else {
          // Token valid — auto-login (user already authenticated on this device)
          setAuthed(true)
        }
      } catch {
        // Verification call failed (network) — don't auto-login, safer to ask again
        setNeedsAuth(true)
        setAuthed(false)
      }
    }

    initAuth()
  }, [])

  useEffect(() => {
    if (!authed) return
    if (!hasSeenOnboarding()) {
      setShowOnboard(true)
    } else if (isSunday() && !hasSeenWeeklyReview()) {
      setTimeout(() => setShowReview(true), 800)
    }
    // Checklist and challenge are now shown as inline cards on Dashboard
    // instead of auto-popping modal overlays — less overwhelming for users
    setTimeout(() => requestPushPermission(userId), 3000)
  }, [authed])

  // ── Heartbeat — update presence every 60s while app is open ──────────────────
  useEffect(() => {
    if (!authed) return
    // Re-read profile name from localStorage each tick so edits propagate immediately
    const sendBeat = () => {
      const p = (() => { try { return JSON.parse(localStorage.getItem('decode_user_profile') || '{}') } catch { return {} } })()
      api.heartbeat(userId, p.name || undefined).catch(() => {})
    }
    sendBeat()  // immediate on auth
    api.getStreak().then(s => setStreakCount(s.current)).catch(() => {})
    const interval = setInterval(sendBeat, 60_000)
    return () => clearInterval(interval)
  }, [authed])

  // ── Midnight refresh ────────────────────────────────────────────────────────
  // When local time crosses midnight, remount all daily components so they
  // start fresh — caches are keyed by date so they automatically read blank state.
  useEffect(() => {
    function scheduleRefresh() {
      const now       = new Date()
      const tomorrow  = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 5, 0)   // 00:00:05 — 5s buffer past midnight
      const msUntil   = tomorrow.getTime() - now.getTime()
      midnightTimer.current = setTimeout(() => {
        setDayKey(k => k + 1)    // remounts Today, Night, Dashboard
        setDashKey(k => k + 1)
        scheduleRefresh()        // schedule for the following midnight
      }, msUntil)
    }
    scheduleRefresh()
    return () => { if (midnightTimer.current) clearTimeout(midnightTimer.current) }
  }, [])

  const showToast = useCallback((msg: string, isErr = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, isErr, visible: true })
    toastTimer.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 2800)
  }, [])

  // Ref tracks current tab for stable callbacks (avoids stale closures)
  const tabRef = useRef(tab)
  tabRef.current = tab

  const handleTabChange = useCallback((t: AppTab) => {
    if (t === tabRef.current) return
    setTab(t)
    if (t === 'week')      setWeekKey(k => k + 1)
    if (t === 'dashboard') setDashKey(k => k + 1)
  }, [])

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    // Don't capture swipes on sliders/range inputs — they need horizontal drag
    const el = e.target as HTMLElement
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') { touchStart.current = null; return }
    if (el.closest('input[type="range"], .slider-wrap, .energy-slider')) { touchStart.current = null; return }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return
    const ids = TABS_PRIMARY.map(t => t.id)
    const idx = ids.indexOf(tabRef.current)
    if (idx < 0) return
    if (dx < 0 && idx < ids.length - 1) handleTabChange(ids[idx + 1])
    else if (dx > 0 && idx > 0) handleTabChange(ids[idx - 1])
  }, [handleTabChange])

  // Must be above all early returns — hooks must run in the same order every render
  const LazyFallback = useMemo(() => <div className="lazy-fallback"><div className="coach-loading-dots"><div /><div /><div /></div></div>, [])

  if (authed === null) return (
    <div className="splash-screen">
      <div className="splash-logo"><DecodeLogo size={56} /></div>
      <div className="splash-title">DECODE</div>
      <div className="splash-loader"><div className="splash-bar" /></div>
    </div>
  )

  if (needsAuth && !authed) return <Auth onAuth={() => setAuthed(true)} />

  if (showOnboard) return (
    <Onboarding onDone={() => {
      markOnboardingDone()
      setShowOnboard(false)
      setTimeout(() => setShowChecklist(true), 400)
    }} />
  )

  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <div className={`offline-banner ${isOffline || pendingCount > 0 ? 'offline-show' : ''}`} role="alert">
        {isOffline ? 'You\'re offline — data will sync when reconnected' : ''}
        {pendingCount > 0 && <span className="sync-count">{pendingCount} log{pendingCount > 1 ? 's' : ''} pending sync</span>}
      </div>
      <div className="app">
        <header className="app-header" role="banner">
          <div className="app-header-left">
            <span className="app-logo" aria-hidden="true"><DecodeLogo size={32} /></span>
            <div>
              <h1 className="app-name">DECODE</h1>
              <div className="app-tagline">D · E · C · O · D · E</div>
            </div>
          </div>
          <div className="dash-header-right">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="checklist-reopen-btn" onClick={() => setShowChecklist(true)} aria-label="Open today's checklist">📋</button>
            <div
              className={`server-status ${serverOk === true ? 'server-ok' : serverOk === false ? 'server-err' : ''}`}
              role="status"
              aria-label={serverOk === true ? 'Server connected' : serverOk === false ? 'Server error' : 'Checking server'}
            >
              <div className="server-dot" aria-hidden="true" />
            </div>
          </div>
        </header>

        <DailyStatus
          key={`status-${dayKey}-${dashKey}`}
          onTabChange={t => handleTabChange(t)}
          activeTab={tab}
          streak={streakCount}
        />

        <main
          id="main-content"
          className="tab-content"
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
          role="main"
        >
          <Suspense fallback={LazyFallback}>
            {tab === 'dashboard' && <Dashboard key={`${dashKey}-${dayKey}`} onTabChange={t => handleTabChange(t as AppTab)} onNewAchievement={a => setPendingAch(a)} />}
            {tab === 'daily'     && <Today onToast={showToast} />}
            {tab === 'review'    && <Review onToast={showToast} weekKey={weekKey} />}
            {tab === 'more'      && <More
              theme={theme}
              onThemeToggle={toggleTheme}
              onTabChange={t => handleTabChange(t as AppTab)}
              onProfileView={() => handleTabChange('dashboard')}
              onExportView={() => handleTabChange('dashboard')}
            />}
            {/* Secondary views — accessible via Home cards or More menu */}
            {tab === 'trends'    && <Trends />}
            {tab === 'coach'     && <Coach />}
            {tab === 'nutrition' && <Nutrition key={dayKey} onToast={showToast} onTabChange={t => handleTabChange(t as AppTab)} />}
            {tab === 'coffee'    && <Coffee key={dayKey} onToast={showToast} />}
            {tab === 'decode'    && <Decode />}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
      {showReview && (
        <WeeklyReview
          onDone={() => { markWeeklyReviewDone(); setShowReview(false); setTimeout(() => setShowChecklist(true), 400) }}
          onTabChange={t => { handleTabChange(t as AppTab); setShowReview(false) }}
        />
      )}

      {showChecklist && (
        <DailyChecklist
          onClose={() => {
            markChecklistSeen()
            setShowChecklist(false)
            // After checklist, show challenge if not yet seen today
            if (shouldShowChallengePopup()) {
              setTimeout(() => setShowChallenge(true), 400)
            }
          }}
          onGoTo={t => { handleTabChange(t as AppTab); markChecklistSeen(); setShowChecklist(false) }}
        />
      )}

      {pendingAch && (
        <AchievementPopup achievement={pendingAch} onDone={() => setPendingAch(null)} />
      )}

      {showChallenge && (
        <ChallengePopup onDone={(accepted) => {
          setShowChallenge(false)
          // If accepted, bump dashKey so Dashboard re-renders with challengeDone=true
          if (accepted) setDashKey(k => k + 1)
        }} />
      )}

      <div className={`toast ${toast.isErr ? 'toast-err' : 'toast-ok'} ${toast.visible ? 'toast-show' : ''}`} role="status" aria-live="polite">
        {toast.isErr ? '⚠️ ' : '✓ '}{toast.msg}
      </div>

      {/* ── Quick Log FAB ── */}
      <QuickLog onToast={showToast} />

      {/* ── Friends floating button ── */}
      <button
        className="friends-fab"
        onClick={() => setShowFriends(true)}
        aria-label="Show online users"
      >
        👥
      </button>

      {/* ── Friends panel ── */}
      <FriendsPanel isOpen={showFriends} onClose={() => setShowFriends(false)} />
      </Suspense>

      {/* ── More menu overlay ── */}
      {/* ── Bottom navigation — 4 tabs (industry standard) ── */}
      <nav className="bottom-tab-bar" role="navigation" aria-label="Main navigation">
        {TABS_PRIMARY.map(t => (
          <button
            key={t.id}
            className={`bottom-tab-btn ${tab === t.id ? 'bottom-tab-active' : ''}`}
            onClick={() => handleTabChange(t.id)}
            aria-label={t.label}
          >
            <span className="bottom-tab-icon">{t.icon}</span>
            <span className="bottom-tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}