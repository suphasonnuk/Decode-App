import { useEffect, useState, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import type { Tab } from './types'
import type { Achievement } from './achievements'
import { getAuthToken, todayStr, getUserId } from './store'
import { isSunday } from './lib/dates'
import { api } from './api'
import Auth             from './components/Auth'
import Onboarding       from './components/Onboarding'
import DailyChecklist   from './components/DailyChecklist'
import WeeklyReview     from './components/WeeklyReview'
import Dashboard        from './components/Dashboard'
import Anchors          from './components/Anchors'
import Today            from './components/Today'
import Night            from './components/Night'
import Week             from './components/Week'
import Trends           from './components/Trends'
import Coach            from './components/Coach'
import Help             from './components/Help'
import Nutrition        from './components/Nutrition'
import Coffee          from './components/Coffee'
import AchievementPopup from './components/AchievementPopup'
import ChallengePopup, { shouldShowChallengePopup } from './components/ChallengePopup'
import FriendsPanel from './components/FriendsPanel'

type AppTab = Tab | 'dashboard' | 'help' | 'coach' | 'nutrition' | 'coffee'

// Primary row — daily use tabs
const TABS_PRIMARY = [
  { id: 'dashboard' as AppTab, icon: '🏠', label: 'Home'    },
  { id: 'daily'     as AppTab, icon: '☀️', label: 'Today'   },
  { id: 'night'     as AppTab, icon: '🌙', label: 'Night'   },
  { id: 'nutrition' as AppTab, icon: '🥗', label: 'Food'    },
  { id: 'coffee'    as AppTab, icon: '☕', label: 'Coffee'  },
]


function hasSeenOnboarding():  boolean { try { return localStorage.getItem('decode_onboarded') === '1' } catch { return false } }
function markOnboardingDone(): void    { try { localStorage.setItem('decode_onboarded', '1') } catch {} }
function shouldShowChecklist(): boolean {
  try { return sessionStorage.getItem('decode_checklist_' + todayStr()) !== 'seen' } catch { return false }
}
function markChecklistSeen(): void {
  try { sessionStorage.setItem('decode_checklist_' + todayStr(), 'seen') } catch {}
}
function hasSeenWeeklyReview(): boolean {
  const d = new Date()
  const key = `decode_weekly_review_${d.getFullYear()}-${d.getMonth() + 1}`
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function markWeeklyReviewDone(): void {
  const d = new Date()
  const key = `decode_weekly_review_${d.getFullYear()}-${d.getMonth() + 1}`
  try { localStorage.setItem(key, '1') } catch {}
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

function AppInner() {
  const [authed,        setAuthed]       = useState<boolean | null>(null)
  const [needsAuth,     setNeedsAuth]    = useState(false)
  const [showOnboard,   setShowOnboard]  = useState(false)
  const [showChecklist, setShowChecklist]= useState(false)
  const [showReview,    setShowReview]   = useState(false)
  const [pendingAch,    setPendingAch]   = useState<Achievement | null>(null)
  const [showChallenge, setShowChallenge] = useState(false)
  const [showFriends,  setShowFriends]  = useState(false)
  const [tab,           setTab]          = useState<AppTab>('dashboard')
  const [transitioning, setTransitioning]= useState(false)
  const [serverOk,      setServerOk]     = useState<boolean | null>(null)
  const [serverInfo,    setServerInfo]   = useState('')
  const [toast,         setToast]        = useState<ToastState>({ msg: '', isErr: false, visible: false })
  const [weekKey,       setWeekKey]      = useState(0)
  const [dashKey,       setDashKey]      = useState(0)
  const [dayKey,        setDayKey]       = useState(0)   // increments at midnight, remounts daily components
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = getUserId()

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
    } else if (shouldShowChecklist()) {
      // Show checklist first, then challenge after it closes
      setTimeout(() => setShowChecklist(true), 800)
    } else if (shouldShowChallengePopup()) {
      // First open of the day and no other popup — show challenge
      setTimeout(() => setShowChallenge(true), 900)
    }
    setTimeout(() => requestPushPermission(userId), 3000)
  }, [authed])

  // ── Heartbeat — update presence every 60s while app is open ──────────────────
  useEffect(() => {
    if (!authed) return
    const profile = (() => { try { return JSON.parse(localStorage.getItem('decode_user_profile') || '{}') } catch { return {} } })()
    const sendBeat = () => api.heartbeat(userId, profile.name || undefined).catch(() => {})
    sendBeat()  // immediate on auth
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
      return setTimeout(() => {
        setDayKey(k => k + 1)    // remounts Today, Night, Dashboard
        setDashKey(k => k + 1)
        scheduleRefresh()        // schedule for the following midnight
      }, msUntil)
    }
    const t = scheduleRefresh()
    return () => clearTimeout(t)
  }, [])

  const showToast = (msg: string, isErr = false) => {
    setToast({ msg, isErr, visible: true })
    setTimeout(() => setToast(p => ({ ...p, visible: false })), 2800)
    if (!isErr) setTimeout(() => setDashKey(k => k + 1), 500)
  }

  const handleTabChange = (t: AppTab) => {
    if (t === tab || transitioning) return
    if (timer.current) clearTimeout(timer.current)
    setTransitioning(true)
    timer.current = setTimeout(() => {
      setTab(t)
      setTransitioning(false)
      if (t === 'week')      setWeekKey(k => k + 1)
      if (t === 'dashboard') setDashKey(k => k + 1)
    }, 150)
  }

  if (authed === null) return (
    <div className="splash-screen">
      <div className="splash-logo">🦞</div>
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
      <div className="app">
        <div className="app-header">
          <div className="app-header-left">
            <span className="app-logo">🦞</span>
            <div>
              <div className="app-name">DECODE</div>
              <div className="app-tagline">Daily direction system</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="checklist-reopen-btn" onClick={() => setShowChecklist(true)} title="Today's checklist">📋</button>
            <div className={`server-status ${serverOk === true ? 'server-ok' : serverOk === false ? 'server-err' : ''}`}>
              <div className="server-dot" />
              <span>{serverInfo || '...'}</span>
            </div>
          </div>
        </div>

        <div className={`tab-content ${transitioning ? 'tab-exit' : 'tab-enter'}`}>
          {tab === 'dashboard' && <Dashboard key={`${dashKey}-${dayKey}`} onTabChange={t => handleTabChange(t as AppTab)} onNewAchievement={a => setPendingAch(a)} />}
          {tab === 'daily'     && <Today   onToast={showToast} />}
          {tab === 'night'     && <Night   onToast={showToast} />}
          {tab === 'week'      && <Week    key={weekKey} />}
          {tab === 'coach'     && <Coach />}
          {tab === 'anchors'   && <Anchors onSaved={() => showToast('Anchors saved ✓')} />}
          {tab === 'trends'    && <Trends />}
          {tab === 'help'      && <Help />}
          {tab === 'nutrition' && <Nutrition key={dayKey} onToast={showToast} onTabChange={t => handleTabChange(t as AppTab)} />}
          {tab === 'coffee'    && <Coffee key={dayKey} onToast={showToast} />}
        </div>
      </div>

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

      <div className={`toast ${toast.isErr ? 'toast-err' : 'toast-ok'} ${toast.visible ? 'toast-show' : ''}`}>
        {toast.isErr ? '⚠️ ' : '✓ '}{toast.msg}
      </div>

      {/* ── Friends floating button ── */}
      <button
        className="friends-fab"
        onClick={() => setShowFriends(true)}
        title="Who's online"
      >
        👥
      </button>

      {/* ── Friends panel ── */}
      <FriendsPanel isOpen={showFriends} onClose={() => setShowFriends(false)} />

      {/* ── Primary bottom tab bar ── */}
      <div className="bottom-tab-bar">
        {TABS_PRIMARY.map(t => (
          <button
            key={t.id}
            className={`bottom-tab-btn ${tab === t.id ? 'bottom-tab-active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            <span className="bottom-tab-icon">{t.icon}</span>
            <span className="bottom-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}