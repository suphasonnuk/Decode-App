// ── Help page content ─────────────────────────────────────────────────────────
// ALL help content lives here. Help.tsx imports from this file.
// Add FAQs, tips, or tab descriptions here — Help.tsx updates automatically.

export interface FaqItem  { q: string; a: string }
export interface TipItem  { icon: string; tip: string; detail: string }
export interface TabInfo  {
  icon: string; name: string; color: string
  when: string; what: string; how: string
}
export interface OutcomeInfo { emoji: string; label: string; color: string; desc: string }
export interface ScoreInfo   { icon: string; label: string; color: string; when: string; desc: string }

// ── Tab descriptions ──────────────────────────────────────────────────────────
export const TABS_INFO: TabInfo[] = [
  {
    icon: '🧭', name: 'Anchors', color: 'var(--accent)',
    when: 'Every Sunday · 5 min',
    what: 'Set 3 weekly goals — work, future, body. Your compass all week.',
    how: 'Write one intention per category → Save Anchors. Syncs to all your devices via BigQuery.',
  },
  {
    icon: '☀️', name: 'Today', color: 'var(--work)',
    when: 'Every morning · 2–3 min',
    what: "See yesterday's plan, pick 3 tasks, set your energy level.",
    how: 'See banner at top → pick one dropdown per category (or type custom) → set energy slider → Save. Come back during the day to tick "Mark done".',
  },
  {
    icon: '🌙', name: 'Night', color: 'var(--body)',
    when: 'Every evening · 3–5 min',
    what: 'Rate the day, score focus and mood, write tomorrow\'s first action.',
    how: 'Pick WIN / PARTIAL / MISS → move the sliders → write one specific action for tomorrow → optionally reflect → Close the Day.',
  },
  {
    icon: '📅', name: 'Week', color: 'var(--future)',
    when: 'Anytime',
    what: 'See your streak, 7-day grid, and anchors. Browse past weeks.',
    how: 'Check your streak at top → tap any day row to expand → tap "Edit this day" to fix mistakes → use ← Prev for past weeks.',
  },
  {
    icon: '🤖', name: 'Coach', color: '#ce93d8',
    when: 'Once a week · on demand',
    what: 'Claude reads your last 30 days of BigQuery data and gives personalized coaching.',
    how: 'Tap "Generate my coaching report" → Claude analyzes patterns → review your score, patterns, and one specific action. Report cached 6 hours.',
  },
  {
    icon: '🥗', name: 'Food', color: 'var(--win)',
    when: 'Every meal',
    what: 'Track nutrition. Photo or dish name — Claude estimates calories and macros automatically.',
    how: 'Tap "Photo / Image" to scan food → review AI estimates → confirm to log. Or "Manual entry" → type dish name → "Estimate" for AI or fill in manually.',
  },
  {
    icon: '📈', name: 'Trends', color: '#f48fb1',
    when: 'After 1–2 weeks of data',
    what: '30-day charts for energy, focus, mood. Weekly win rate bars.',
    how: 'Check once a week. Read the insight above each chart. Only meaningful after several days of logging.',
  },
]

// ── Scores ────────────────────────────────────────────────────────────────────
export const SCORES_INFO: ScoreInfo[] = [
  {
    icon: '⚡', label: 'Energy', color: 'var(--work)', when: 'Morning',
    desc: 'How energized you feel right now. 1 = drained, 10 = peak. Logged before the day — gives a baseline to compare against your outcome.',
  },
  {
    icon: '🎯', label: 'Focus', color: 'var(--future)', when: 'Night',
    desc: 'How well you concentrated today. 1 = scattered, 10 = deep work. Trends shows which conditions lead to your best focus days.',
  },
  {
    icon: '😊', label: 'Mood', color: 'var(--body)', when: 'Night',
    desc: 'How you felt overall today. Not about being happy — about feeling aligned and in control. Low mood days reveal patterns in Trends.',
  },
]

// ── Outcomes ──────────────────────────────────────────────────────────────────
export const OUTCOMES_INFO: OutcomeInfo[] = [
  { emoji: '🏆', label: 'WIN',     color: 'var(--win)',     desc: 'Completed most tasks and moved forward' },
  { emoji: '⚡', label: 'PARTIAL', color: 'var(--partial)', desc: 'Some progress, but not everything done'  },
  { emoji: '🔄', label: 'MISS',    color: 'var(--miss)',    desc: 'Tough day — tomorrow is a fresh start'   },
]

// ── Daily rhythm ──────────────────────────────────────────────────────────────
export const DAILY_RHYTHM = [
  { time: 'Sunday',         icon: '🧭', color: 'var(--accent)', action: 'Set weekly anchors',   detail: 'Anchors tab' },
  { time: 'Every morning',  icon: '☀️', color: 'var(--work)',   action: "Log today's 3 tasks",  detail: 'Today tab'   },
  { time: 'During the day', icon: '✓',  color: 'var(--muted2)', action: 'Tick tasks as done',   detail: 'Today tab'   },
  { time: 'Every evening',  icon: '🌙', color: 'var(--body)',   action: 'Close the day',         detail: 'Night tab'  },
]

// ── FAQs ──────────────────────────────────────────────────────────────────────
export const FAQS: FaqItem[] = [
  { q: 'What if I forget to log in the morning?',
    a: 'Just do it when you remember — even at 2pm. The date is still correct. The checklist shows a nudge until you log.' },
  { q: 'What if I skip the Night tab?',
    a: 'No streak that day. You also miss the plan banner next morning. Even a 2-minute MISS log is better than nothing.' },
  { q: "Why can't I save the Night tab?",
    a: "You haven't filled the Today tab yet. Fill Today first — Night requires your task data to already be saved." },
  { q: 'I made a mistake — can I edit a past day?',
    a: 'Yes. Week tab → tap any completed row → tap "Edit this day" → change and save.' },
  { q: 'Can I use the app on multiple devices?',
    a: 'Yes. Data lives in BigQuery and syncs automatically. Enter your access token on each new device.' },
  { q: 'Trends shows no data yet.',
    a: 'You need 3–4 completed days (morning + night) before patterns appear. Keep logging daily.' },
  { q: 'What breaks a WIN streak?',
    a: 'Any PARTIAL or MISS day resets it to zero. Only consecutive WIN days count.' },
  { q: 'The AI Coach says it needs more data.',
    a: 'You need at least 3–4 logged days for Claude to give meaningful insights. After a week of daily logging the report becomes much more accurate.' },
  { q: 'The food photo analysis failed or gave wrong numbers.',
    a: 'Try again — AI estimates vary. For unclear photos, use Manual entry and type the dish name instead. You can edit any field before saving.' },
  { q: 'How accurate is the nutrition AI?',
    a: "Claude estimates based on typical portion sizes. For Thai restaurant food it's generally within 10–20%. Always review the numbers before confirming." },
  { q: 'How do push notifications work?',
    a: 'An 8am nudge and 9pm reminder are sent via your browser\'s push system. Tap Allow when the app asks. Requires Cloud Scheduler to be set up by your admin.' },
  { q: 'How do I install this as a phone app?',
    a: 'iPhone: open in Safari → Share → Add to Home Screen. Android: Chrome → ⋮ → Add to home screen. Opens full-screen like a native app.' },
  { q: 'Can I export my data?',
    a: 'Yes — BigQuery Console → decode_tracker → any table → Export. You own your data completely.' },
]

// ── Tips ──────────────────────────────────────────────────────────────────────
export const TIPS: TipItem[] = [
  { icon: '📱', tip: 'Add to phone home screen',
    detail: 'iPhone: Safari → Share → Add to Home Screen. Android: Chrome → ⋮ → Add to home screen. Opens instantly like a native app.' },
  { icon: '⏰', tip: 'Set two phone reminders',
    detail: '8am: "Open DECODE, pick 3 tasks." 9pm: "Open DECODE, close the day." Two taps a day is the entire system.' },
  { icon: '🎯', tip: 'Pick small, completable tasks',
    detail: 'Not "finish the whole project" — instead "review the report for 30 min." Completable beats ambitious every time.' },
  { icon: '🔥', tip: 'Protect your streak',
    detail: "Once you hit 5+ WIN days, you won't want to break it. That's the system working against your laziness." },
  { icon: '🌙', tip: "Tomorrow's plan is the most important field",
    detail: 'Write something specific: "I will open the Dataform repo at 9am." Shows up as a banner the next morning.' },
  { icon: '🥗', tip: 'Log food right after eating',
    detail: "You forget what you ate. Take a quick photo at the table — takes 10 seconds and the AI does the rest." },
  { icon: '🤖', tip: 'Check Coach tab after 2+ weeks',
    detail: 'The coaching report is weak with 3 days of data. With 2+ weeks, Claude spots real patterns like "you always WIN when you do the body habit."' },
  { icon: '📊', tip: "Don't check Trends too early",
    detail: 'Trends are only useful after 2+ weeks. Check once a week, not daily. Patterns take time to emerge.' },
  { icon: '✏️', tip: 'Use the edit feature freely',
    detail: 'Made a mistake? Week tab → tap any row → Edit this day. Fix it after — no need to be perfect.' },
]