/**
 * DECODE logo — geometric "D" made of stacked bars representing the 3 pillars:
 * Work (top), Future (mid), Body (bottom). The bars form a stylized "D" shape
 * that also resembles a progress/decode signal.
 *
 * Uses hex colors (not oklch) for maximum SVG compatibility.
 */
export default function DecodeLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="DECODE logo"
    >
      {/* Background circle — dark slate */}
      <circle cx="32" cy="32" r="30" fill="#1a1b2e" stroke="#2d2f4a" strokeWidth="1.5" />

      {/* Vertical stem of D — vivid violet */}
      <rect x="16" y="16" width="4" height="32" rx="2" fill="#9b6dff" />

      {/* Top bar — Work (electric blue) */}
      <rect x="20" y="16" width="22" height="6" rx="3" fill="#5b8af5" />

      {/* Middle bar — Future (vivid violet, widest = belly of D) */}
      <rect x="20" y="29" width="26" height="6" rx="3" fill="#9b6dff" />

      {/* Bottom bar — Body (emerald green) */}
      <rect x="20" y="42" width="22" height="6" rx="3" fill="#3dc88e" />

      {/* Connecting arc on the right (the curve of the D) */}
      <path
        d="M42 19 C52 19 52 45 42 45"
        stroke="#9b6dff"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}
