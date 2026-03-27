// ── Variable Reward System ────────────────────────────────────────────────────
// Achievements fire at UNPREDICTABLE thresholds — not round numbers.
// This is intentional: predictable milestones (10, 20, 30) feel mechanical.
// Unpredictable ones (7, 13, 21, 33) feel like genuine discoveries.

export interface Achievement {
  id: string
  emoji: string
  title: string
  desc: string
  color: string
}

const STREAK_ACHIEVEMENTS: Achievement[] = [
  { id: 'streak_3',  emoji: '🔥', title: 'First flame',      desc: '3-day WIN streak',                   color: '#ff8a65' },
  { id: 'streak_7',  emoji: '🏆', title: 'One week strong',  desc: '7 consecutive WIN days',             color: 'var(--future)' },
  { id: 'streak_13', emoji: '⚡', title: 'Baker\'s dozen',   desc: '13-day streak — you\'re consistent', color: 'var(--work)' },
  { id: 'streak_21', emoji: '💎', title: 'Habit locked in',  desc: '21 days — science says it\'s a habit',color: '#ce93d8' },
  { id: 'streak_33', emoji: '🚀', title: 'Unstoppable',      desc: '33-day streak',                      color: 'var(--win)' },
  { id: 'streak_50', emoji: '👑', title: 'Royalty',          desc: '50 consecutive WIN days',            color: 'var(--accent)' },
]

const WIN_RATE_ACHIEVEMENTS: Achievement[] = [
  { id: 'winrate_50', emoji: '📈', title: 'Half the battle',  desc: '50%+ win rate this month',         color: 'var(--work)'   },
  { id: 'winrate_70', emoji: '🎯', title: 'Sharp shooter',    desc: '70%+ win rate this month',         color: 'var(--future)' },
  { id: 'winrate_90', emoji: '✨', title: 'Near perfect',     desc: '90%+ win rate this month',         color: 'var(--accent)' },
]

const ENERGY_ACHIEVEMENTS: Achievement[] = [
  { id: 'energy_8', emoji: '⚡', title: 'High voltage',       desc: 'Average energy 8+ this week',     color: 'var(--work)'   },
  { id: 'energy_9', emoji: '🌟', title: 'Peak performer',    desc: 'Average energy 9+ this week',     color: 'var(--accent)' },
]

const SPECIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win',    emoji: '🌱', title: 'First WIN day',   desc: 'You rated your first day as WIN', color: 'var(--win)'    },
  { id: 'full_week',    emoji: '🗓️', title: 'Perfect week',    desc: '7/7 WIN days in one week',        color: 'var(--future)' },
  { id: 'future_daily', emoji: '🚀', title: 'Future builder',  desc: 'Future task done 7 days in a row',color: '#ce93d8'       },
  { id: 'body_daily',   emoji: '💪', title: 'Body first',      desc: 'Body habit done 7 days in a row', color: 'var(--body)'   },
  { id: 'reflection_7', emoji: '💭', title: 'Deep thinker',    desc: 'Wrote 7 reflections',             color: '#80cbc4'       },
  { id: 'night_owl',    emoji: '🌙', title: 'Night owl',       desc: 'Closed the day 5 nights in a row',color: '#9fa8da'       },
]

export const ALL_ACHIEVEMENTS = [
  ...STREAK_ACHIEVEMENTS,
  ...WIN_RATE_ACHIEVEMENTS,
  ...ENERGY_ACHIEVEMENTS,
  ...SPECIAL_ACHIEVEMENTS,
]

// ── Check which achievements are unlocked based on stats ─────────────────────
export interface UserStats {
  currentStreak: number
  winRatePct: number       // 0–100
  avgEnergy: number        // 1–10
  totalWins: number
  longestStreak: number
}

export function getUnlockedAchievements(stats: UserStats): Achievement[] {
  const unlocked: Achievement[] = []

  // Streak achievements
  for (const a of STREAK_ACHIEVEMENTS) {
    const threshold = parseInt(a.id.split('_')[1])
    if (stats.longestStreak >= threshold) unlocked.push(a)
  }

  // First WIN
  if (stats.totalWins >= 1) {
    unlocked.push(SPECIAL_ACHIEVEMENTS.find(a => a.id === 'first_win')!)
  }

  // Win rate
  for (const a of WIN_RATE_ACHIEVEMENTS) {
    const threshold = parseInt(a.id.split('_')[1])
    if (stats.winRatePct >= threshold) unlocked.push(a)
  }

  // Energy
  for (const a of ENERGY_ACHIEVEMENTS) {
    const threshold = parseFloat(a.id.split('_')[1])
    if (stats.avgEnergy >= threshold) unlocked.push(a)
  }

  return unlocked.filter(Boolean)
}

// ── Detect newly unlocked achievement (for celebration popup) ─────────────────
const SEEN_KEY = 'decode_seen_achievements'

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function markSeen(ids: string[]): void {
  try {
    const seen = getSeenIds()
    ids.forEach(id => seen.add(id))
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {}
}

export function getNewAchievements(stats: UserStats): Achievement[] {
  const unlocked = getUnlockedAchievements(stats)
  const seen     = getSeenIds()
  const newOnes  = unlocked.filter(a => !seen.has(a.id))
  if (newOnes.length > 0) markSeen(newOnes.map(a => a.id))
  return newOnes
}
