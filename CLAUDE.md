# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev              # Start Next.js dev server
bun build            # Production build
bun lint             # ESLint
bun test             # Run unit tests (vitest, jsdom)
bun test:watch       # Unit tests in watch mode
bun test:integration # Integration tests against a real Postgres DB (requires .env.local)

# Run a single test file
bunx vitest run src/stores/pantry.test.ts

# Database schema management
bun db:generate      # Generate new Drizzle migration from schema changes
bun db:push          # Push schema to DB (used in CI; skips migration files)
bun db:studio        # Open Drizzle Studio UI
```

CI uses Bun (`bun install --frozen-lockfile`, `bunx vitest run --changed`).

## Architecture

### Tech stack
Next.js 15 App Router, TypeScript (strict), Drizzle ORM, Zustand, PrimeReact, SCSS.

### Path alias
`@/` resolves to `./src/`. All internal imports should use this.

### Data flow — three distinct layers

**1. DB schema** — `src/db/schema.ts`  
Drizzle table definitions. Entities: `foods`, `recipes`, `ingredients`, `pantryItems`, `users`, `login_attempts`. Numeric columns (macros, quantities) are stored as `numeric`/`varchar` in Postgres and must be coerced with `Number(...)` when mapping to TypeScript types.

**2. Server-side data functions** — `src/lib/{foods,recipes,pantry,users}.ts`  
Pure async functions that query the DB directly. Used only in Next.js Server Components and API route handlers. Each file exports `get*`, `create*`, `update*`, `delete*` functions.

**3. Client-side API wrappers** — `src/lib/api/{foods,recipes,pantry,users}.ts`  
Thin `fetch` wrappers that call the Next.js API routes (`/api/…`). Used by client components and Zustand stores to mutate data.

### Next.js App Router conventions
- `app/` contains only page files and API routes; they import views from `src/views/`.
- Server pages fetch initial data (e.g., `getRecipes()`) and pass it as props to client view components.
- Client views receive `initialRecipes` / `initialFoods`, hydrate the Zustand store in a `useEffect`, then operate entirely on the store thereafter.
- `app/layout.tsx` is `force-dynamic`; it fetches recipes server-side and passes them to `ClientLayout` to build the nav menu.

### Zustand stores — `src/stores/`
- `useRecipeStore`, `useFoodStore`, `usePantryStore`, `useSettingsStore`
- Stores are the single source of truth for client-side state after initial hydration.
- Each store exports a `reset*Store()` helper used in tests.

### API routes — `app/api/`
All write operations in API routes must go through the `taskRunner` singleton (`src/lib/TaskRunner.ts`) via `taskRunner.run(() => ...)`. This centralises the point where retry logic or audit hooks can be added.

### Database connection — `src/db/index.ts`
In production (`NODE_ENV === 'production'`), uses `@vercel/postgres`. Otherwise, builds a `pg.Pool` from env vars. `drizzle.config.ts` reads `.env.local` by default; set `DRIZZLE_ENV=production` to target `.env.production`.

### Soft-delete pattern
Most entities (recipes, pantry items, users) are never hard-deleted. Set `dateDeleted = new Date()` and filter with `isNull(table.dateDeleted)` in queries. `deleteFood` is currently a hard delete (exception).

### Slug convention
URLs use slugs derived from names (`toSlug()` in `src/utils/slug.ts`). Slugs are auto-generated on create/update whenever `name` changes. API routes accept slugs as path params (e.g., `/api/recipes/[slug]`).

### Unit conversion
`src/utils/unitConversion.ts` handles mass (g/kg/oz/lb/mg) and volume (ml/l/cup/Tbs/tsp/fl-oz) conversions. Custom units (slice, piece, etc.) are not convertible. `calculateCalories()` returns `null` when cross-category conversion is attempted.

## Testing

**Unit tests** (`vitest.config.ts`, jsdom environment):
- Exclude `*.integration.test.ts` files.
- Global `fetch` is mocked in `src/test/setup.ts` — mutations echo back the request body.
- Next.js modules (`next/link`, `next/navigation`) are mocked via `src/test/mocks/`.

**Integration tests** (`vitest.integration.config.ts`, node environment):
- Require a real Postgres connection. Copy `.env.example` to `.env.local` and fill in DB credentials before running.
- Run serially (`fileParallelism: false`), 30-second timeout.
- Tests clean up after themselves by deleting rows matching `name LIKE 'Test%'`.
- In CI, the schema is pushed with `db:push` before tests run; `DATABASE_URL` env var is used (not the individual `DATABASE_*` vars).
