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
      {/* Background circle — warm dark */}
      <circle cx="32" cy="32" r="30" fill="#2a2318" stroke="#3d3528" strokeWidth="1.5" />

      {/* Vertical stem of D — warm teal */}
      <rect x="16" y="16" width="4" height="32" rx="2" fill="#4db8a4" />

      {/* Top bar — Work (warm blue) */}
      <rect x="20" y="16" width="22" height="6" rx="3" fill="#6b9fd4" />

      {/* Middle bar — Future (soft amber, widest = belly of D) */}
      <rect x="20" y="29" width="26" height="6" rx="3" fill="#d4a66b" />

      {/* Bottom bar — Body (sage green) */}
      <rect x="20" y="42" width="22" height="6" rx="3" fill="#5cb88a" />

      {/* Connecting arc on the right (the curve of the D) */}
      <path
        d="M42 19 C52 19 52 45 42 45"
        stroke="#4db8a4"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}
