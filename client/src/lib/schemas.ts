// Zod schemas — runtime validation for all API payloads
// Catches bad data before it reaches BigQuery and gives clear error messages.

import { z } from 'zod'

// ── Daily log payload ─────────────────────────────────────────────────────────
export const LogPayloadSchema = z.object({
  log_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  week_start:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  work_anchor:   z.string().nullable().optional(),
  future_anchor: z.string().nullable().optional(),
  body_anchor:   z.string().nullable().optional(),
  work_task:     z.string().min(1, 'Work task is required'),
  future_task:   z.string().min(1, 'Future task is required'),
  body_task:     z.string().min(1, 'Body task is required'),
  work_done:     z.boolean(),
  future_done:   z.boolean(),
  body_done:     z.boolean(),
  energy_level:  z.number().int().min(1).max(10),
  focus_level:   z.number().int().min(1).max(10).nullable().optional(),
  mood_level:    z.number().int().min(1).max(10).nullable().optional(),
  day_outcome:   z.enum(['win', 'partial', 'miss']).nullable().optional(),
  tomorrow_action: z.string().nullable().optional(),
  reflection:    z.string().nullable().optional(),
})

// ── User profile payload ──────────────────────────────────────────────────────
export const UserProfileSchema = z.object({
  user_id:          z.string().min(1),
  name:             z.string().optional().nullable(),
  email:            z.string().email().optional().nullable().or(z.literal('')),
  birth_year:       z.number().int().min(1940).max(2010).nullable().optional(),
  gender:           z.string().optional().nullable(),
  occupation:       z.string().optional().nullable(),
  primary_goal:     z.string().optional().nullable(),
  sleep_target_hrs: z.number().min(4).max(12).nullable().optional(),
  timezone:         z.string().optional().nullable(),
})

// ── Push subscription ─────────────────────────────────────────────────────────
export const PushSubscriptionSchema = z.object({
  user_id:      z.string().min(1),
  endpoint:     z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
  notify_morning: z.boolean().default(true),
  notify_evening: z.boolean().default(true),
})

// ── Coach request ─────────────────────────────────────────────────────────────
export const CoachRequestSchema = z.object({
  user_id: z.string().min(1),
})

// Type inference
export type LogPayloadInput     = z.infer<typeof LogPayloadSchema>
export type UserProfileInput    = z.infer<typeof UserProfileSchema>
export type PushSubInput        = z.infer<typeof PushSubscriptionSchema>
export type CoachRequestInput   = z.infer<typeof CoachRequestSchema>