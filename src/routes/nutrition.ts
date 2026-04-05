import { Router, Request, Response } from 'express'
import { bigquery, BQ }             from '../bigquery'
import {
  localDateStr, todayStr, safeStr, safeErr, rateLimit, getUserId,
} from '../route-utils'
import { BigQuery } from '@google-cloud/bigquery'

const router = Router()

// ── Server-side analysis dedup cache ─────────────────────────────────────────
// Prevents duplicate API calls for the same dish name or image within a TTL window.
// Dish names: 60-min TTL (standardised dishes don't change). Images: 10-min TTL (session dedup).
const _analysisCache = new Map<string, { result: any; expires: number }>()

function _cacheKey(body: { image_base64?: string; dish_name?: string }): string {
  if (body.dish_name) return 'text:' + body.dish_name.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80)
  if (body.image_base64) {
    const b = body.image_base64
    // Fingerprint: length + first 200 + last 100 chars — fast, sufficient for dedup
    return 'img:' + b.length + ':' + b.slice(0, 200) + b.slice(-100)
  }
  return ''
}

function _getCachedAnalysis(key: string): any | null {
  if (!key) return null
  const entry = _analysisCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) { _analysisCache.delete(key); return null }
  return entry.result
}

function _setCachedAnalysis(key: string, result: any, ttlMs: number) {
  if (!key) return
  _analysisCache.set(key, { result, expires: Date.now() + ttlMs })
  // Evict expired entries when cache grows large (prevents memory leak)
  if (_analysisCache.size > 200) {
    const now = Date.now()
    for (const [k, v] of _analysisCache) if (now > v.expires) _analysisCache.delete(k)
  }
}

// ── Shared AI call helper ─────────────────────────────────────────────────
async function callAI(
  apiKey: string, system: string, messages: any[], label: string,
  model = 'claude-sonnet-4-6', maxTokens = 600
): Promise<any> {
  const ctrl    = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 35_000)
  const res     = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: ctrl.signal,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system, messages }),
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error('[' + label + '] API error ' + res.status + ': ' + t.slice(0, 100))
  }
  const data = await res.json() as any
  const raw  = data.content?.[0]?.text ?? ''
  if (!raw) throw new Error('[' + label + '] Empty response')

  let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
  if (s !== -1 && e > s) clean = clean.slice(s, e + 1)
  return JSON.parse(clean)
}

// ── Reference tables for nutrition estimation ─────────────────────────────

const PROTEIN_DENSITY_TABLE =
  'PROTEIN DENSITY REFERENCE (g protein per 100g COOKED weight — use these exact values):\n' +
  '  Chicken breast (cooked, no skin):  31g P/100g\n' +
  '  Chicken thigh (cooked, no skin):   26g P/100g\n' +
  '  Chicken with skin:                 24g P/100g\n' +
  '  Pork loin/tenderloin (cooked):     27g P/100g\n' +
  '  Ground pork (cooked):              17g P/100g  ← commonly overestimated\n' +
  '  Pork belly (cooked):               16g P/100g  ← high fat, lower protein ratio\n' +
  '  Moo ping / grilled pork skewer:    20g P/100g  ← marinated, mixed cuts\n' +
  '  Beef (cooked, lean):               26g P/100g\n' +
  '  Shrimp (cooked):                   24g P/100g\n' +
  '  Fish fillet (cooked, white fish):  22g P/100g\n' +
  '  Egg (whole, 50g):                   6g P each\n' +
  '  Tofu (firm):                         8g P/100g\n' +
  '  Jasmine rice (cooked):               2.7g P/100g  ← very low, often over-assigned\n' +
  '  Noodles (cooked):                    3g P/100g\n' +
  '  Vegetables (mixed Thai):             1-2g P/100g  ← do not assign more\n' +
  '  Thai sauces (fish/oyster/soy 20g):   1g P total   ← almost no protein\n\n' +
  'PROTEIN REALITY CHECK: After estimating protein_g, verify:\n' +
  '  (protein source weight in grams) × (protein density from table above) / 100 = expected protein_g\n' +
  '  If your protein_g is more than 20% above this, reduce it to match the table.'

const ATWATER_FACTORS =
  'CALORIE CALCULATION (Atwater general factors — use exactly these):\n' +
  '  Protein:       4.0 kcal/g\n' +
  '  Carbohydrates: 4.0 kcal/g\n' +
  '  Fat:           9.0 kcal/g\n' +
  '  Alcohol:       7.0 kcal/g (ignore unless present)\n' +
  'Total calories MUST equal (protein_g × 4) + (carbs_g × 4) + (fat_g × 9). Verify before outputting.'

const THAI_EATING_CONTEXT =
  'THAI EATING CONTEXT — this is critical for accurate estimation:\n\n' +
  'USER PROFILE: This app is used by Thai people living in Bangkok, Thailand. ' +
  'Average Thai adult: male ~165cm/65kg, female ~158cm/54kg. ' +
  'Daily calorie needs: Thai male ~1800-2100kcal, Thai female ~1500-1800kcal. ' +
  'Thai portions are calibrated to these body sizes — significantly smaller than Western portions.\n\n' +
  'HOW THAI PEOPLE EAT:\n' +
  '- Rice is the foundation: 1 cup cooked jasmine rice (~150g, 195kcal) is the base of most meals\n' +
  '- Protein is a SIDE DISH: In Thai culture, protein dishes are shared or served in small amounts alongside rice. ' +
  'A single-person order typically contains only 60-100g of actual meat — not 120-180g as in Western portions\n' +
  '- Street food portions are smaller: street food stalls in Bangkok serve 300-380g total (plate+rice). ' +
  'Restaurant portions for tourists may be slightly larger but still within Thai norms\n' +
  '- Office lunch (popular in Bangkok): typically 35-45 baht meals, small plate with rice, 50-80g protein, small vegetable portion\n' +
  '- Shared dishes: if someone photographs a shared dish (gaeng, tom yum, stir-fry in a central bowl), ' +
  'estimate per-person serving as 1/3 to 1/4 of the total dish visible\n\n' +
  'PORTION SIZE REALITY CHECK FOR THAI CONTEXT:\n' +
  '- A Thai chicken stir-fry single serve: 60-90g chicken (NOT 120-150g)\n' +
  '- A Thai pork dish single serve: 70-100g pork (NOT 120-180g)\n' +
  '- A bowl of Thai soup/curry: 150-200ml liquid + 60-80g protein + vegetables\n' +
  '- Total calories for a typical Thai lunch: 400-600kcal (NOT 700-900kcal)\n' +
  '- Total calories for a typical Thai dinner: 450-650kcal\n' +
  '- If your estimate for a single Thai meal exceeds 700kcal, double-check your portion assumptions\n\n' +
  'WHAT THAI FOOD IS NOT:\n' +
  '- Not a Western steak (200-300g protein)\n' +
  '- Not an American portion (supersized, high protein)\n' +
  '- Not a gym meal prep (lean chicken breast 150g+)\n' +
  'The protein in a Thai dish is typically a small component alongside rice, vegetables, and sauce.'

const PORTION_TABLE =
  'STANDARD PORTION WEIGHTS (use as anchors — do not deviate without clear visual evidence):\n' +
  '  Thai plate with rice:      350–420g total | rice ~150g | protein+sauce 170–220g | veg 30–50g\n' +
  '  Thai curry (no rice):      200–250g\n' +
  '  Pad Thai single serve:     280–320g\n' +
  '  Som tum small bowl:        150–180g\n' +
  '  Moo ping x3 skewers:       90–120g\n' +
  '  Khao man gai plate:        380–420g total\n' +
  '  Noodle soup bowl:          450–550g total\n' +
  '  Bakery item / cookie each: 25–45g\n' +
  '  Thai milk tea medium:      350ml | full sugar ~280kcal | half sugar ~160kcal\n' +
  '  Non-Thai: use USDA SR / NHS standard portion references.'

// Condensed Thai context for the verifier — key numbers only, no narrative prose
const THAI_CONTEXT_BRIEF =
  'THAI PORTIONS (Bangkok): Single Thai meal 400-600kcal typical; flag if >700kcal. ' +
  'Protein per serve: 60-100g meat (NOT 120-180g Western portions). Rice base ~150g = 195kcal. ' +
  'Shared dish: estimate 1/3-1/4 of visible quantity per person.'

const FEW_SHOT_EXAMPLES =
  'CALIBRATION EXAMPLES (verified reference values — use these to calibrate your scale):\n\n' +
  'Example 1 — Khao pad gai (chicken fried rice, Thai restaurant single plate):\n' +
  '  Ingredients: jasmine rice 180g (234kcal), chicken breast 80g (88kcal), egg 1 whole 50g (72kcal), ' +
  'oil 12g (108kcal), vegetables 40g (15kcal), soy+oyster sauce 20g (25kcal)\n' +
  '  Total: 380g | 542kcal | protein 28g | carbs 62g | fat 20g | sodium 820mg\n' +
  '  Macro check: 28*4 + 62*4 + 20*9 = 112+248+180 = 540kcal ≈ 542 ✓\n\n' +
  'Example 2 — Pad kra pao moo (basil pork, no rice):\n' +
  '  Ingredients: ground pork 120g cooked (~17g P/100g cooked = 20g protein, 240kcal), ' +
  'oil 15g (135kcal, 0g protein), fish sauce+oyster sauce 25g (30kcal, 1g protein), ' +
  'basil+vegetables 40g (12kcal, 1g protein)\n' +
  '  Total: 200g | 417kcal | protein 22g | carbs 10g | fat 32g | sodium 1050mg\n' +
  '  Macro check: 22*4 + 10*4 + 32*9 = 88+40+288 = 416kcal ≈ 417 ✓\n' +
  '  NOTE: Ground pork is leaner than assumed — do not assign >20-22g protein for 120g cooked\n\n' +
  'Example 3 — 5 butter cookies (Thai bakery gift box style, ~30g each):\n' +
  '  Ingredients per cookie: butter 8g (72kcal), flour 14g (51kcal), sugar 7g (28kcal), jam 1g (3kcal)\n' +
  '  Per cookie: 30g | 154kcal | protein 1.5g | carbs 18g | fat 8g | sodium 55mg\n' +
  '  5 cookies: 150g | 770kcal | protein 7.5g | carbs 90g | fat 40g | sodium 275mg'

// ── POST /nutrition/analyze ───────────────────────────────────────────────
router.post('/nutrition/analyze', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  try {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
    if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set' })

    const { image_base64, image_media_type, dish_name, user_targets } = req.body
    if (!image_base64 && !dish_name) return res.status(400).json({ error: 'Provide either image_base64 or dish_name' })

    if (image_base64 && typeof image_base64 === 'string' && image_base64.length > 10_000_000) {
      return res.status(400).json({ error: 'Image too large — max 10MB' })
    }

    const VALID_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (image_base64 && image_media_type && !VALID_MEDIA.includes(image_media_type)) {
      return res.status(400).json({ error: 'Invalid image type — use JPEG, PNG, or WebP' })
    }

    // Check dedup cache before calling AI (same dish name or image in the last 10-60 min)
    const analysisCacheKey = _cacheKey({ image_base64, dish_name })
    const cachedAnalysis   = _getCachedAnalysis(analysisCacheKey)
    if (cachedAnalysis) {
      console.log('[nutrition/analyze] Dedup cache hit:', analysisCacheKey.slice(0, 50))
      return res.json({ ...cachedAnalysis, from_cache: true })
    }

    // ── PASS 1: Estimator ─────────────────────────────────────────────────

    const estimatorSystem =
      'You are a registered dietitian with 20 years of clinical practice based in Bangkok, Thailand. ' +
      'You are trained in the McCance and Widdowson food composition tables and USDA SR database. ' +
      'You specialise in Thai and Southeast Asian cuisine and understand exactly how Thai people eat — ' +
      'smaller portions, rice-based meals, protein as a side component, not a Western-style main.\n\n' +
      'YOUR METHOD: Always build nutrition estimates from ingredients up — never guess the total directly. ' +
      'Always apply Thai portion context — a Thai single serving has 60-100g protein source, not 120-180g.\n\n' +
      THAI_EATING_CONTEXT + '\n\n' +
      PORTION_TABLE + '\n\n' +
      PROTEIN_DENSITY_TABLE + '\n\n' +
      ATWATER_FACTORS + '\n\n' +
      FEW_SHOT_EXAMPLES + '\n\n' +
      'ACCURACY RULE: Your estimate must represent the statistical median — not the high end, not the low end. ' +
      'Do not add safety buffer. Do not hedge by estimating high. ' +
      'Another dietitian estimating the same dish must land within 10% of your calories.\n\n' +
      'CHAIN-OF-THOUGHT: You MUST show your reasoning in the notes field. ' +
      'Format: "Ingredients: [item Xg=Ykcal, ...]. Macro check: P*4+C*4+F*9=[Z]kcal ✓"\n\n' +
      'OUTPUT: Respond with ONLY valid JSON — no preamble, no markdown. NUMBERS ONLY — no explanatory text, no health advice:\n' +
      JSON.stringify({
        dish_name: 'exact dish name',
        serving_description: 'e.g. 1 plate (~390g) with jasmine rice',
        estimated_weight_g: 0,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        confidence: 'high',
        notes: 'ONE LINE ONLY: ingredient weights and macro check. e.g. rice 150g+chicken 80g=542kcal, 28*4+62*4+20*9=540✓',
      }, null, 2) +
      '\nDo NOT include health_impact, recommendations, or any explanatory text. Numbers and dish name only.'

    const estimatorMsg: any[] = image_base64 ? [
      { type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } },
      { type: 'text', text:
        'Analyze this food image using your ingredient-buildup method:\n' +
        'Step 1: Identify the dish and all visible ingredients\n' +
        'Step 2: Estimate weight of each ingredient using the portion table\n' +
        'Step 3: Calculate kcal for each ingredient using Atwater factors\n' +
        'Step 4: Sum to get total macros\n' +
        'Step 5: PROTEIN CHECK — for each protein source: weight(g) × density(g/100g) / 100 = protein_g. Use the density table. Do not inflate.\n' +
        'Step 6: Verify calories = (P×4)+(C×4)+(F×9). Adjust macros if off by >5%\n' +
        'Step 7: Output JSON with full reasoning in notes field\n\n' +
        'Aim for the median estimate. Do not inflate. Protein is the most commonly overestimated macro.\n' +
        'Remember: this is a Thai person in Bangkok eating a typical Thai meal. ' +
        'Protein portion is likely 60-100g of meat, not 120-180g. Total meal likely 400-600kcal.'
      },
    ] : [
      { type: 'text', text:
        'Estimate nutrition for: "' + safeStr(dish_name, 200) + '"\n\n' +
        'Use your ingredient-buildup method:\n' +
        'Step 1: State the standard serving size (use portion table)\n' +
        'Step 2: List each ingredient with estimated weight\n' +
        'Step 3: Calculate kcal per ingredient using Atwater factors\n' +
        'Step 4: Sum macros\n' +
        'Step 5: PROTEIN CHECK — for each protein source: weight(g) × density(g/100g) / 100 = protein_g. Use the density table.\n' +
        'Step 6: Verify calories = (P×4)+(C×4)+(F×9). Adjust macros if off\n' +
        'Step 7: Output JSON with reasoning in notes\n\n' +
        'Aim for the statistical median. Protein is the most commonly overestimated macro — use density table values.\n' +
        'Remember: Thai Bangkok portion. Protein source is likely 60-100g. Total meal likely 400-600kcal. ' +
        'If total exceeds 700kcal for a single Thai meal, reconsider your portion assumptions.'
      },
    ]

    // ── PASS 2: Verifier system prompt ────────────────────────────────────

    const verifierSystem =
      'You are a senior clinical nutritionist peer-reviewing a nutrition estimate. ' +
      'Your role is to CHECK the estimate — not re-estimate from scratch.\n\n' +
      THAI_CONTEXT_BRIEF + '\n\n' +
      PORTION_TABLE + '\n\n' +
      PROTEIN_DENSITY_TABLE + '\n\n' +
      ATWATER_FACTORS + '\n\n' +
      'VERIFICATION CHECKLIST:\n' +
      '1. MACRO MATH: calories must = (P×4)+(C×4)+(F×9). Correct macros if off by >5%.\n' +
      '2. PROTEIN REALITY: weight(g) × density(g/100g)/100 = expected protein_g.\n' +
      '   Reduce if estimate exceeds expected by >20%.\n' +
      '   Common errors: >25g protein from 80-100g mixed/fatty meat; ' +
      'chicken breast density (31g/100g) applied to ground or fatty cuts; protein assigned to rice/sauces.\n' +
      '3. PORTION REALISM: check total against PORTION_TABLE and Thai context. Flag/correct if outside range.\n\n' +
      'agrees=true if calories within 10% AND protein within 15% of your verified values.\n' +
      'Always output verified_* values — copy estimate values if you agree, correct if you do not.\n\n' +
      'OUTPUT: Valid JSON only — no preamble:\n' +
      JSON.stringify({
        agrees: true,
        verified_calories: 0,
        verified_protein_g: 0,
        verified_carbs_g: 0,
        verified_fat_g: 0,
        verified_fiber_g: 0,
        verified_sugar_g: 0,
        verified_sodium_mg: 0,
        verified_estimated_weight_g: 0,
        disagreement_reason: 'null or brief explanation',
        confidence: 'high',
      }, null, 2)

    // ── Execute PASS 1 ────────────────────────────────────────────────────
    let estimate: any
    try {
      estimate = await callAI(ANTHROPIC_KEY, estimatorSystem, [{ role: 'user', content: estimatorMsg }], 'estimator', 'claude-sonnet-4-6', 600)
    } catch (err) {
      console.error('[nutrition/analyze] Estimator failed:', (err as Error).message)
      return res.status(502).json({ error: 'Nutrition analysis failed — please try again' })
    }

    // ── Execute PASS 2 ────────────────────────────────────────────────────
    const verifierInput = image_base64
      ? 'The nutritionist estimated this dish from the image. Review their estimate and provide your independent verification.\n\nTheir estimate:\n' + JSON.stringify(estimate, null, 2)
      : 'The nutritionist estimated nutrition for "' + safeStr(dish_name, 200) + '". Review and verify:\n\n' + JSON.stringify(estimate, null, 2)

    const verifierMessages: any[] = image_base64
      ? [
          { type: 'image', source: { type: 'base64', media_type: image_media_type || 'image/jpeg', data: image_base64 } },
          { type: 'text', text: verifierInput },
        ]
      : [{ type: 'text', text: verifierInput }]

    let verification: any
    try {
      verification = await callAI(ANTHROPIC_KEY, verifierSystem, [{ role: 'user', content: verifierMessages }], 'verifier', 'claude-sonnet-4-6', 400)
    } catch (err) {
      console.warn('[nutrition/analyze] Verifier failed, using estimator only:', (err as Error).message)
      return res.json({ success: true, nutrition: estimate, source: image_base64 ? 'ai_image' : 'ai_text', verified: false })
    }

    // ── Reconcile ─────────────────────────────────────────────────────────
    const estCal   = Number(estimate.calories)        || 0
    const verCal   = Number(verification.verified_calories) || 0
    const diverges = estCal > 0 && verCal > 0 && Math.abs(estCal - verCal) / estCal > 0.15

    let finalNutrition: any
    if (!diverges || verification.agrees) {
      finalNutrition = {
        ...estimate,
        calories:             verCal   || estCal,
        protein_g:            Number(verification.verified_protein_g)   || estimate.protein_g,
        carbs_g:              Number(verification.verified_carbs_g)      || estimate.carbs_g,
        fat_g:                Number(verification.verified_fat_g)        || estimate.fat_g,
        fiber_g:              Number(verification.verified_fiber_g)      || estimate.fiber_g,
        sugar_g:              Number(verification.verified_sugar_g)      || estimate.sugar_g,
        sodium_mg:            Number(verification.verified_sodium_mg)    || estimate.sodium_mg,
        estimated_weight_g:   Number(verification.verified_estimated_weight_g) || estimate.estimated_weight_g,
        confidence:           verification.confidence || estimate.confidence,
      }
    } else {
      const avg = (a: number, b: number) => a && b ? Math.round((a + b) / 2) : (a || b)
      finalNutrition = {
        ...estimate,
        calories:           avg(estCal,   verCal),
        protein_g:          avg(Number(estimate.protein_g),   Number(verification.verified_protein_g)),
        carbs_g:            avg(Number(estimate.carbs_g),     Number(verification.verified_carbs_g)),
        fat_g:              avg(Number(estimate.fat_g),       Number(verification.verified_fat_g)),
        fiber_g:            avg(Number(estimate.fiber_g),     Number(verification.verified_fiber_g)),
        sugar_g:            avg(Number(estimate.sugar_g),     Number(verification.verified_sugar_g)),
        sodium_mg:          avg(Number(estimate.sodium_mg),   Number(verification.verified_sodium_mg)),
        confidence:         'medium',
        notes:              (estimate.notes || '') + ' | Estimates diverged (' + estCal + ' vs ' + verCal + 'kcal) — averaged. ' + (verification.disagreement_reason || ''),
      }
      console.log('[nutrition/analyze] Divergence: estimator=' + estCal + ' verifier=' + verCal + ' final=' + finalNutrition.calories)
    }

    // ── PASS 3: Haiku health impact ───────────────────────────────────────
    const haikusystem =
      'You are a nutrition communicator. Given verified nutrition facts for a dish, ' +
      'write a brief, accurate health impact summary. Be specific — reference actual nutrient values. ' +
      'Do not be alarmist. Be balanced and practical. Keep it concise.\n\n' +
      'OUTPUT: Respond with ONLY valid JSON:\n' +
      JSON.stringify({
        rating: 'positive|neutral|mixed|negative',
        summary: '2-3 plain sentences about the main health effects of this specific dish based on its actual numbers.',
        highlights: ['One specific benefit with the nutrient name and amount', 'Second benefit if applicable'],
        watch: 'One specific concern based on the numbers, or null if none',
      }, null, 2) +
      '\nrating guide: positive=mostly beneficial nutrients | neutral=balanced, ok in moderation | ' +
      'mixed=some benefits and some concerns | negative=high in nutrients to limit (sugar/sat fat/sodium)'

    const targetsLine = (user_targets?.calories && user_targets?.protein_g)
      ? '\nUser daily targets: ' + user_targets.calories + 'kcal, ' + user_targets.protein_g + 'g protein — contextualize health impact against these.'
      : ''

    const haikuInput =
      'Dish: ' + (finalNutrition.dish_name || 'Unknown dish') + '\n' +
      'Serving: ' + (finalNutrition.serving_description || '') + '\n' +
      'Nutrition facts:\n' +
      '  Calories: ' + finalNutrition.calories + 'kcal\n' +
      '  Protein: ' + finalNutrition.protein_g + 'g\n' +
      '  Carbs: ' + finalNutrition.carbs_g + 'g\n' +
      '  Fat: ' + finalNutrition.fat_g + 'g\n' +
      '  Fiber: ' + finalNutrition.fiber_g + 'g\n' +
      '  Sugar: ' + finalNutrition.sugar_g + 'g\n' +
      '  Sodium: ' + finalNutrition.sodium_mg + 'mg' +
      targetsLine + '\n\n' +
      'Write a brief health impact summary for this dish.'

    let healthImpact: any = null
    try {
      healthImpact = await callAI(
        ANTHROPIC_KEY, haikusystem,
        [{ role: 'user', content: haikuInput }],
        'health-impact',
        'claude-haiku-4-5-20251001',
        400
      )
    } catch (err) {
      console.warn('[nutrition/analyze] Haiku health impact failed:', (err as Error).message)
    }

    const analysisResult = {
      success: true,
      nutrition: { ...finalNutrition, health_impact: healthImpact },
      source:   image_base64 ? 'ai_image' : 'ai_text',
      verified: true,
    }
    // Cache: 60min for dish names (same dish = same result), 10min for images (session dedup)
    _setCachedAnalysis(analysisCacheKey, analysisResult, image_base64 ? 10 * 60_000 : 60 * 60_000)
    return res.json(analysisResult)
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'Analysis timed out — try again' : safeErr(err, 'nutrition.analyze')
    return res.status(500).json({ error: msg })
  }
})

// ── POST /nutrition/log ───────────────────────────────────────────────────
router.post('/nutrition/log', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const b = req.body
    if (!b.dish_name) return res.status(400).json({ error: 'Missing dish_name' })

    const entry_id = 'nu_' + Date.now() + '_' + Math.random().toString(36).slice(2,9)
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id, user_id: userId, log_date: localDateStr(new Date()), logged_at: BigQuery.timestamp(new Date()),
      meal_type:  b.meal_type  ? safeStr(b.meal_type, 50)   : null,
      dish_name:  safeStr(b.dish_name, 200),
      calories:   b.calories   != null ? Number(b.calories)   : null,
      protein_g:  b.protein_g  != null ? Number(b.protein_g)  : null,
      carbs_g:    b.carbs_g    != null ? Number(b.carbs_g)    : null,
      fat_g:      b.fat_g      != null ? Number(b.fat_g)      : null,
      fiber_g:    b.fiber_g    != null ? Number(b.fiber_g)    : null,
      sugar_g:    b.sugar_g    != null ? Number(b.sugar_g)    : null,
      sodium_mg:  b.sodium_mg  != null ? Number(b.sodium_mg)  : null,
      source:     safeStr(b.source || 'manual', 20),
      notes:      b.notes      ? safeStr(b.notes, 500)      : null,
      ai_analysis:b.ai_analysis ? safeStr(b.ai_analysis, 2000) : null,
    }])
    console.log(`[nutrition] Saved: ${safeStr(b.dish_name,30)} user:${userId.slice(0,8)}`)
    return res.json({ success: true, entry_id })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.log') })
  }
})

// ── GET /nutrition/today ──────────────────────────────────────────────────
router.get('/nutrition/today', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const today = todayStr()
    let rows: any[] = []

    try {
      const [fullRows] = await bigquery.query({
        query: `
          SELECT entry_id, log_date, meal_type, dish_name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, notes, logged_at, edited_at
          FROM (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY entry_id ORDER BY COALESCE(edited_at, logged_at) DESC) AS rn
            FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
            WHERE user_id  = @userId
              AND log_date = @today
          )
          WHERE rn = 1
            AND (deleted IS NULL OR deleted = FALSE)
          ORDER BY logged_at ASC
        `,
        params: { userId, today },
      })
      rows = fullRows as any[]
    } catch (queryErr) {
      console.warn('[nutrition/today] Falling back to simple query:', (queryErr as Error).message?.slice(0, 100))
      const [simpleRows] = await bigquery.query({
        query: `
          SELECT entry_id, log_date, meal_type, dish_name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, notes, logged_at
          FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
          WHERE user_id  = @userId
            AND log_date = @today
          ORDER BY logged_at ASC
        `,
        params: { userId, today },
      })
      rows = simpleRows as any[]
    }

    const totals = rows.length === 0 ? null :
      rows.reduce((acc:any, r:any) => ({
        calories:  (acc.calories||0)  + (r.calories||0),
        protein_g: (acc.protein_g||0) + (r.protein_g||0),
        carbs_g:   (acc.carbs_g||0)   + (r.carbs_g||0),
        fat_g:     (acc.fat_g||0)     + (r.fat_g||0),
        fiber_g:   (acc.fiber_g||0)   + (r.fiber_g||0),
        sugar_g:   (acc.sugar_g||0)   + (r.sugar_g||0),
        sodium_mg: (acc.sodium_mg||0) + (r.sodium_mg||0),
      }), { calories:0, protein_g:0, carbs_g:0, fat_g:0, fiber_g:0, sugar_g:0, sodium_mg:0 })

    return res.json({ entries: rows, totals })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.today') })
  }
})

// ── GET /nutrition/history ────────────────────────────────────────────────
router.get('/nutrition/history', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 90)

    const [rows] = await bigquery.query({
      query: `
        SELECT log_date, COUNT(*) AS meal_count,
          ROUND(SUM(IFNULL(calories,0)),1) AS total_calories,
          ROUND(SUM(IFNULL(protein_g,0)),1) AS total_protein_g,
          ROUND(SUM(IFNULL(carbs_g,0)),1)   AS total_carbs_g,
          ROUND(SUM(IFNULL(fat_g,0)),1)     AS total_fat_g,
          ROUND(SUM(IFNULL(fiber_g,0)),1)   AS total_fiber_g
        FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\`
        WHERE user_id  = @userId
          AND log_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
          AND (deleted IS NULL OR deleted = FALSE)
        GROUP BY log_date
        ORDER BY log_date DESC
      `,
      params: { userId, days },
    })
    return res.json(rows)
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.history') })
  }
})

// ── PUT /nutrition/entry/:entry_id ────────────────────────────────────────
router.put('/nutrition/entry/:entry_id', async (req: Request, res: Response) => {
  try {
    const userId   = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })
    const entry_id = safeStr(req.params.entry_id, 100)
    if (!entry_id)  return res.status(400).json({ error: 'Missing entry_id' })

    const [ownerRows] = await bigquery.query({
      query: `SELECT user_id FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\` WHERE entry_id = @entry_id LIMIT 1`,
      params: { entry_id },
    })
    if ((ownerRows as any[]).length > 0 && (ownerRows as any[])[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not your entry' })
    }

    const b = req.body
    if (!b.dish_name) return res.status(400).json({ error: 'Missing dish_name' })
    const now = BigQuery.timestamp(new Date())
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id,
      user_id:     userId,
      log_date:    safeStr(b.log_date || localDateStr(new Date()), 10),
      logged_at:   now,
      edited_at:   now,
      meal_type:   b.meal_type  ? safeStr(b.meal_type, 50)    : null,
      dish_name:   safeStr(b.dish_name, 200),
      calories:    b.calories   != null ? Number(b.calories)  : null,
      protein_g:   b.protein_g  != null ? Number(b.protein_g) : null,
      carbs_g:     b.carbs_g    != null ? Number(b.carbs_g)   : null,
      fat_g:       b.fat_g      != null ? Number(b.fat_g)     : null,
      fiber_g:     b.fiber_g    != null ? Number(b.fiber_g)   : null,
      sugar_g:     b.sugar_g    != null ? Number(b.sugar_g)   : null,
      sodium_mg:   b.sodium_mg  != null ? Number(b.sodium_mg) : null,
      source:      safeStr(b.source || 'manual', 20),
      notes:       b.notes      ? safeStr(b.notes, 500)       : null,
      ai_analysis: b.ai_analysis ? safeStr(b.ai_analysis, 2000) : null,
    }])
    return res.json({ success: true, entry_id })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.edit') })
  }
})

// ── DELETE /nutrition/entry/:entry_id ─────────────────────────────────────
router.delete('/nutrition/entry/:entry_id', async (req: Request, res: Response) => {
  try {
    const userId   = getUserId(req)
    if (!userId) return res.status(400).json({ error: 'Missing user_id' })
    const entry_id = safeStr(req.params.entry_id, 100)
    if (!entry_id)  return res.status(400).json({ error: 'Missing entry_id' })

    const [ownerRows] = await bigquery.query({
      query: `SELECT user_id FROM \`${BQ.PROJECT}.${BQ.DATASET}.nutrition_log\` WHERE entry_id = @entry_id LIMIT 1`,
      params: { entry_id },
    })
    if ((ownerRows as any[]).length > 0 && (ownerRows as any[])[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not your entry' })
    }

    const now = BigQuery.timestamp(new Date())
    await bigquery.dataset(BQ.DATASET).table('nutrition_log').insert([{
      entry_id,
      user_id:     userId,
      log_date:    localDateStr(new Date()),
      logged_at:   now,
      edited_at:   now,
      deleted:     true,
      dish_name:   '_deleted_',
      source:      'deleted',
    }])
    console.log(`[nutrition/delete] Soft-deleted entry ${entry_id} for user:${userId.slice(0, 8)}`)
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: safeErr(err, 'nutrition.delete') })
  }
})

export default router
