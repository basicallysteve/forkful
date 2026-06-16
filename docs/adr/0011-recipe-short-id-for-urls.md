# ADR-0011: Short ID for Recipe URLs

## Status
Accepted

## Context
Recipe URLs used a slug derived purely from the recipe name (`/recipes/chicken-soup`). The `slug` column had a global unique constraint, meaning two users could not both have a recipe named "Chicken Soup" — the second insert would fail. As the user base grows, name collisions are inevitable.

## Decision
Add an opaque 8-character nanoid `shortId` column to the `recipes` table. The new canonical URL structure is `/recipes/[shortId]/[slug]` (e.g. `/recipes/x7k2m9ab/chicken-soup`).

- The server resolves the recipe by `shortId` alone; the slug segment is ignored for lookup.
- If the slug in the request is absent or stale (e.g. after a rename), the server issues a 308 permanent redirect (Next.js `permanentRedirect`) to the canonical URL with the current slug — preserving SEO and keeping old links working.
- API routes switch from `/api/recipes/[slug]` to `/api/recipes/[id]` for consistency.
- The global unique constraint on `recipes.slug` is dropped — slug is now cosmetic only.
- All existing recipe rows are backfilled in the migration using `translate(encode(gen_random_bytes(6), 'base64'), '+/=', '-_')` — 6 bytes of entropy encoded as 8 base64url characters (48 bits).

## Alternatives considered
- **ID-prefixed slug** (`/recipes/42-chicken-soup`): exposes the auto-increment primary key, enabling enumeration of all recipes and leaking growth metrics.
- **Slug + short suffix** (`/recipes/chicken-soup-x7k2m9`): ambiguous to parse since slugs also contain hyphens; a fixed-length suffix or special delimiter is required.
- **Keep slug-only, enforce uniqueness at the application layer** (e.g. append `-2`): ugly URLs and still a leaky abstraction — slugs stop being purely name-derived.

## Consequences
- `shortId` is generated at recipe creation time (nanoid, 8 chars, URL-safe alphabet).
- Renames update the slug but never the `shortId` — links are permanent.
- The slug unique constraint removal means two users can have identically-named recipes without conflict.
- Foods and Products retain their existing slug-based URLs (out of scope).
