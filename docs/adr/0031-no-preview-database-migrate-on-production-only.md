# ADR 0031: No preview database; migrate on production only

## Status
Accepted, superseded in part (on hold, 2026-11-18): the "migrate on production only" decision is paused. `vercel-build` is back to `next build` and migrations are applied manually, because `drizzle-kit migrate` fails on Vercel (the `pg` driver rejects the Supabase pooler certificate with `ssl: true`) and the migrations history is unbaselined (databases were built with `db:push`, so replay from `0000` fails). See #273; the real fix is tracked in #276 (a drizzle-orm `migrate()` script using `ssl: 'require'`, after baselining production's `drizzle.__drizzle_migrations`). The no-preview-database decision and the rule that previews never migrate still stand. The text below is the original decision, kept as written.

## Context
`vercel-build` used to be `drizzle-kit migrate || true && next build`, which swallowed migration failures (#273). Preview deployments also have no database of their own: their env vars point at the same project as production, so a migration run from a preview build would change the production schema from an unmerged branch.

## Decision
- There is no separate preview or branch database.
- `vercel-build` runs `drizzle-kit migrate` only when `VERCEL_ENV=production`, then `next build`. Previews skip the migration.
- A failed production migration fails the build, so Vercel keeps the previous deployment live.
- Previews use whatever database their env vars point to. Don't test destructively on a preview.

## Considered Options
- **Separate preview database (Supabase branching or a second project):** rejected for now. Extra cost and setup, plus seeding and keeping its schema in step, for a small team.
- **Migrate on every build, preview included:** rejected. An unmerged branch would alter the shared schema.
- **Migrate on production only (chosen).**

## Consequences
- A preview of a branch that needs a new column or table won't have it until production is migrated, so schema-dependent features can fail on that preview.
- Migrations should be additive and backwards compatible, since the old deployment keeps serving until the new build succeeds, and previews run against the production schema.
- Revisit if previews need real isolation: add a preview database and migrate it from the preview branch of the build script.
