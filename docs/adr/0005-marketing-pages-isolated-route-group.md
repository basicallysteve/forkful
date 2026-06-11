# Marketing pages live in an isolated route group with no PrimeReact dependency

We created an `app/(marketing)/` route group with its own lightweight layout and SCSS — no PrimeReact components, no recipe-fetching — and a `MarketingNav`/`MarketingFooter` that all logged-out users see regardless of path (enforced in `ClientLayout` via `!isLoggedIn`).

**Current limitation:** The root `app/layout.tsx` is `force-dynamic` and imports the full PrimeReact stylesheet globally (needed for the authenticated app shell). Because `(marketing)` routes nest inside this root layout, they inherit `force-dynamic` and cannot be statically generated yet. Marketing pages are still SSR, which is acceptable for SEO but not ideal.

**Planned follow-up:** Move authenticated app routes into an `app/(app)/` route group with their own root layout, leaving `app/layout.tsx` as a minimal shell. This will allow `(marketing)` pages to be statically generated at build time.

## Considered Options

- **CMS (e.g. Contentful, Sanity)** — rejected because the sole author is a developer; MDX files in the repo are simpler and free.
- **Shared root layout for all pages** — rejected because the root layout's `getRecipes()` call and PrimeReact imports prevent static generation and add unnecessary weight to public-facing pages.
- **Separate Next.js app for marketing** — rejected as over-engineering for a solo project; a route group achieves sufficient separation.
