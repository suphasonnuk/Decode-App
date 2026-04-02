import { todayStr } from '../store'

export function shouldShowChallengePopup(): boolean {
  try {
    return localStorage.getItem('decode_challenge_seen_' + todayStr()) !== '1'
  } catch {
    return false
  }
}
