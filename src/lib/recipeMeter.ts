/**
 * Recipe View Limit metering — the pure decision logic behind the Signup Wall.
 *
 * Edge-safe: no Node/`server-only` imports, so it runs inside middleware. The
 * cookie signing/verification codec lives alongside in `recipeMeterCookie.ts`;
 * this module is deliberately crypto-free so the decision is trivially testable.
 * See ADR-0020.
 */

/** Distinct public Recipes an Anonymous Visitor may fully view per window. */
export const RECIPE_VIEW_LIMIT = 5

/** Rolling window length: 30 days in milliseconds. */
export const METER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Decoded meter cookie: when the current window opened, and which Recipes were seen. */
export type MeterPayload = {
  /** Epoch ms marking the start of the current 30-day window. */
  periodStart: number
  /** Recipe Short IDs viewed within the current window. */
  ids: string[]
}

export type MeterDecision = {
  /** True when the Recipe should render behind the Signup Wall. */
  gated: boolean
  /** The payload to persist back to the cookie. */
  nextPayload: MeterPayload
}

/**
 * Decide whether a Recipe view is gated, and produce the next cookie payload.
 *
 * - A fresh visitor or an expired window starts a new window with an empty set.
 * - Re-viewing an already-seen Recipe is always allowed and never re-charged.
 * - Under the limit: the Recipe is recorded and allowed.
 * - At the limit with a new Recipe: gated, and NOT recorded (so it becomes
 *   viewable after sign-up or the next window without having consumed a slot).
 */
export function decideMeter(
  payload: MeterPayload | null,
  shortId: string,
  now: number,
): MeterDecision {
  const windowExpired = payload !== null && now - payload.periodStart > METER_WINDOW_MS
  const base: MeterPayload =
    payload === null || windowExpired ? { periodStart: now, ids: [] } : payload

  if (base.ids.includes(shortId)) {
    return { gated: false, nextPayload: base }
  }

  if (base.ids.length < RECIPE_VIEW_LIMIT) {
    return { gated: false, nextPayload: { periodStart: base.periodStart, ids: [...base.ids, shortId] } }
  }

  return { gated: true, nextPayload: base }
}
