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
```

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
