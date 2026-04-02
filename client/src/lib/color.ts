// Creates a transparent version of a CSS color using color-mix (works with oklch, var(), hex, etc.)
export const alpha = (color: string, pct: number) =>
  `color-mix(in oklch, ${color} ${pct}%, transparent)`
