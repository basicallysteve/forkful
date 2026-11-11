/**
 * Recipe access entitlements.
 *
 * Edge-safe by design: no `server-only` imports, so both Server Components and
 * middleware (Edge runtime) can call these. This is the single extension point
 * for the future free/paid tier split — see ADR-0020.
 */

/** The viewer context an entitlement decision is made against. */
export type RecipeViewer = {
  /** True when the request carries an authenticated Session. */
  isAuthenticated: boolean
}

/**
 * Whether the viewer holds Unlimited Recipe Access — i.e. may view Recipes
 * without being subject to the Recipe View Limit.
 *
 * Phase 1: every logged-in User is unlimited; Anonymous Visitors are metered.
 * Phase 2 (paid tier): this becomes `viewer.tier === 'paid'` — the only change
 * needed to fold free Users under the limit.
 */
export function hasUnlimitedRecipeAccess(viewer: RecipeViewer): boolean {
  return viewer.isAuthenticated
}
