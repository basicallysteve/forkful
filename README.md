# Forkful

Forkful is a recipe management app — save recipes, track your pantry, and manage dietary preferences.

## Tech stack

- **Next.js 15** App Router, TypeScript (strict)
- **Drizzle ORM** + PostgreSQL (Vercel Postgres in production)
- **Zustand** for client-side state
- **PrimeReact** component library, SCSS
- **Vitest** + Testing Library for unit and integration tests

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy the example env file and fill in your database credentials:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign session cookies |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (see setup below) |

### 3. Push the database schema

```bash
bun db:push
```

### 4. Start the dev server

```bash
bun dev
```

## Vercel Blob setup (avatar uploads)

Avatar images are stored in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob). You need to set this up once before avatar uploads will work locally or in production.

**1. Link your project to Vercel** (skip if already deployed):

```bash
npx vercel link
```

**2. Add Blob storage in the Vercel dashboard:**

- Go to your project → **Storage** → **Create Database** → **Blob**
- Follow the prompts to enable it

**3. Pull the token into your local environment:**

```bash
npx vercel env pull .env.local
```

This adds `BLOB_READ_WRITE_TOKEN` to `.env.local`. Vercel sets it automatically in production once Blob is enabled.

## Commands

```bash
bun dev              # Start Next.js dev server
bun build            # Production build
bun lint             # ESLint
bun test             # Run unit tests (vitest, jsdom)
bun test:watch       # Unit tests in watch mode
bun test:integration # Integration tests (requires .env.local with DB credentials)

bun db:generate      # Generate Drizzle migration from schema changes
bun db:push          # Push schema to DB
bun db:studio        # Open Drizzle Studio UI

bun seed:usda        # Seed USDA foods into the database in .env.local (dev)
bun seed:usda:prod   # Deliberately seed production (.env.production)
bun seed:usda-branded       # Import USDA Branded products into the database in .env.local (dev)
bun seed:usda-branded:prod  # Deliberately import into production (.env.production)
bun link:product-foods       # AI-link unlinked products to parent foods in .env.local (dev); add -- --dry-run --limit N --concurrency N
bun link:product-foods:prod  # Deliberately link in production (.env.production)
```

## Deploys and database migrations

Vercel runs `bun run vercel-build`: `drizzle-kit migrate` runs only when `VERCEL_ENV=production`, then `next build`. Preview deployments skip the migration (see [ADR-0031](docs/adr/0031-no-preview-database-migrate-on-production-only.md)).

- **A failed production migration fails the build.** The previous production deployment stays live, so new code never ships against a database that is missing its columns.
- **Previews don't migrate.** A preview of a branch that needs a new column or table won't have it until the migration has been applied to production (merge, let the production build migrate, then re-check the preview). Until then, features that use the new schema may fail on the preview.
- **Previews use whatever database their env vars point to.** There is no separate preview database, so don't do destructive testing on a preview: treat it as working against real data.

On Vercel the migrate step reads the platform's env vars (`DATABASE_URL`, then `POSTGRES_URL`, then `DATABASE_POSTGRES_URL`), the same variables and order the app uses at runtime (see `src/db/resolveDrizzleEnv.ts` and `src/db/index.ts`). Nothing reads an env file there.

## Project structure

```
app/              # Next.js App Router pages and API routes
src/
  components/     # Shared UI components
  constants/      # Shared option lists (cuisine, dietary, etc.)
  db/             # Drizzle schema and DB connection
  hooks/          # React hooks
  lib/            # Server-side data functions and client API wrappers
  stores/         # Zustand stores
  types/          # TypeScript types
  utils/          # Utility functions
  views/          # Page-level client components
```
