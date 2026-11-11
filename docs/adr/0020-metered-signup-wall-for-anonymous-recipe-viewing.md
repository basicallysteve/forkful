# Metered Signup Wall for anonymous recipe viewing

Anonymous Visitors may fully view up to 5 distinct public Recipes per rolling 30-day window; past that, the Recipe detail page renders a Signup Wall that keeps the Recipe summary visible but withholds the Ingredient list and Recipe Steps. We enforce this server-side (a "hard" wall) rather than with a client-side blur, so the limit can't be defeated by disabling JavaScript or reading page source. This is phase 1 of an eventual free/paid tier: the gate is built around an **Unlimited Recipe Access** entitlement (today: every logged-in User has it, every Anonymous Visitor lacks it) so that when billing ships, only the entitlement lookup changes — free Users fall under the same limit, paid Users keep access.

## Mechanics

- **Where it runs.** Counting happens in middleware (`proxy.ts`), because App Router Server Components cannot write cookies — only middleware, Route Handlers, and Server Actions can. Middleware reads the meter cookie, decides gated/not-gated for the request's Recipe Short ID, writes the updated cookie, and passes the decision to the page via a request header (e.g. `x-recipe-gated`). The Server Component reads that header with `headers()` and, when gated, skips the ingredient/step sub-queries and passes empty arrays to `RecipeIndex`.
- **What counts.** A signed cookie stores `{ periodStart, ids: [...] }` — the set of distinct Recipe Short IDs viewed. Re-viewing a Recipe already in the set never re-consumes the allowance and never walls a previously-seen Recipe. The 6th *new* distinct Recipe is gated and is **not** added to the set. When `now - periodStart > 30 days`, middleware resets `ids` and re-stamps `periodStart`.
- **Crawler Exemption.** Requests whose User-Agent matches a known crawler (via the `isbot` package) bypass metering entirely and always receive the full Recipe. To keep this from reading as cloaking, the Recipe page emits `Recipe` JSON-LD with `isAccessibleForFree: false` and a `hasPart` paywall annotation, per Google's flexible-sampling guidance.

## Considered options

- **Soft client-side wall (blur/overlay full content).** Rejected: trivially bypassed via view-source, disabling JS, or reader mode. Fails to enforce the limit.
- **Server-side metering keyed by IP address.** Rejected for the anonymous tier: shared IPs (NAT, corporate, carrier) over-block real users, dynamic IPs self-reset, storing IPs adds PII/GDPR weight, and it is still defeated by incognito+VPN. Cost and false-blocks outweigh the marginal robustness.
- **Permanent limit (no reset).** Rejected in favour of a rolling 30-day window, which preserves casual return visits and habit-formation while still walling within a month.

## Consequences

- **The anonymous meter is intentionally bypassable.** Clearing cookies, incognito, or switching browser resets the count. This is accepted: the wall is a registration nudge for the median visitor, not DRM. The real enforcement teeth arrive in phase 2, where a free logged-in User's count is tied to their account server-side and cannot be cleared.
- **Recipe pages become per-request dynamic.** Gated state depends on the cookie and User-Agent, so recipe responses must not be shared-cache/CDN-cached across visitors. Reading `headers()`/`cookies()` already opts the route into dynamic rendering.
- **Minor over-count edge.** Middleware sees only the URL, so an anonymous hit on a private or nonexistent Short ID (which 404s anyway) still consumes a slot. Accepted as rare rather than moved into a Route Handler.
- **Analytics is kept out of the metering path.** Recipe View Count (a denormalised popularity counter on the Recipe) is deliberately *not* incremented in this middleware — a per-view DB write does not belong in edge middleware and must not be coupled to the security-critical gate. It is recorded separately via a client-fired beacon to a Route Handler through `taskRunner`. The two share only the recipe-detail trigger, not a store or a code path.
