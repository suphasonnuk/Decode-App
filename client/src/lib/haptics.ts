// Haptic feedback for mobile devices
// Uses navigator.vibrate() which is supported on Android Chrome, Firefox, Samsung Internet.
// iOS Safari ignores this silently — no errors.

export function hapticLight() {
  try { navigator.vibrate?.(10) } catch {}
}

export function hapticMedium() {
  try { navigator.vibrate?.(25) } catch {}
}

export function hapticSuccess() {
  try { navigator.vibrate?.([15, 50, 15]) } catch {}
}

export function hapticHeavy() {
  try { navigator.vibrate?.([30, 60, 30, 60, 30]) } catch {}
}
