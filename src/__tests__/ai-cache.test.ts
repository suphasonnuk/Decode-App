import { describe, it, expect } from 'vitest'

// Test the nutrition reconciliation logic extracted as a pure function
// This mirrors the divergence logic in routes/nutrition.ts

function reconcileEstimates(
  estimate: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  verification: { agrees: boolean; verified_calories: number; verified_protein_g: number; verified_carbs_g: number; verified_fat_g: number }
) {
  const estCal   = estimate.calories || 0
  const verCal   = verification.verified_calories || 0
  const diverges = estCal > 0 && verCal > 0 && Math.abs(estCal - verCal) / estCal > 0.15

  if (!diverges || verification.agrees) {
    return {
      calories:  verCal || estCal,
      protein_g: verification.verified_protein_g || estimate.protein_g,
      carbs_g:   verification.verified_carbs_g   || estimate.carbs_g,
      fat_g:     verification.verified_fat_g     || estimate.fat_g,
      diverged:  false,
    }
  }

  const avg = (a: number, b: number) => a && b ? Math.round((a + b) / 2) : (a || b)
  return {
    calories:  avg(estCal, verCal),
    protein_g: avg(estimate.protein_g, verification.verified_protein_g),
    carbs_g:   avg(estimate.carbs_g,   verification.verified_carbs_g),
    fat_g:     avg(estimate.fat_g,     verification.verified_fat_g),
    diverged:  true,
  }
}

describe('nutrition reconciliation', () => {
  it('uses verifier values when estimates agree (<15% difference)', () => {
    const result = reconcileEstimates(
      { calories: 500, protein_g: 25, carbs_g: 60, fat_g: 18 },
      { agrees: true, verified_calories: 520, verified_protein_g: 23, verified_carbs_g: 62, verified_fat_g: 19 }
    )
    expect(result.calories).toBe(520)
    expect(result.protein_g).toBe(23)
    expect(result.diverged).toBe(false)
  })

  it('averages when estimates diverge >15%', () => {
    const result = reconcileEstimates(
      { calories: 500, protein_g: 30, carbs_g: 60, fat_g: 18 },
      { agrees: false, verified_calories: 700, verified_protein_g: 20, verified_carbs_g: 80, verified_fat_g: 25 }
    )
    expect(result.calories).toBe(600) // avg(500, 700)
    expect(result.protein_g).toBe(25) // avg(30, 20)
    expect(result.diverged).toBe(true)
  })

  it('uses verifier even with slight divergence if agrees=true', () => {
    const result = reconcileEstimates(
      { calories: 400, protein_g: 20, carbs_g: 50, fat_g: 15 },
      { agrees: true, verified_calories: 480, verified_protein_g: 22, verified_carbs_g: 52, verified_fat_g: 16 }
    )
    // 480 vs 400 = 20% diff, but agrees=true → use verifier
    expect(result.calories).toBe(480)
    expect(result.diverged).toBe(false)
  })

  it('handles zero calories gracefully', () => {
    const result = reconcileEstimates(
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      { agrees: false, verified_calories: 500, verified_protein_g: 25, verified_carbs_g: 60, verified_fat_g: 18 }
    )
    // estCal=0 means diverges=false → use verifier values
    expect(result.calories).toBe(500)
    expect(result.diverged).toBe(false)
  })
})
