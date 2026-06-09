# ADR 0001 — Auth.js for OAuth with manual schema adaptation

## Status
Accepted

## Context
Forkful needs Google and Apple Sign In alongside the existing username/password login. The existing session system is a hand-rolled JWT cookie (`session`) read by `getSessionUser()`. The `users` table has app-specific columns (cuisine preferences, dietary restrictions, avatar, etc.).

## Decision
Use Auth.js to manage all authentication (OAuth and credentials). Migrate the existing JWT cookie session to Auth.js sessions. Do **not** use the official Auth.js Drizzle adapter — instead adapt Auth.js manually via callbacks to preserve the existing `users` table shape.

Schema changes:
- `users.password` → nullable (OAuth users have no password)
- Add `oauth_accounts` table: `id`, `userId`, `provider`, `providerAccountId`, unique on `(provider, providerAccountId)`. No OAuth tokens stored.

Account linking: if an OAuth sign-in email matches an existing user, the OAuth account is silently linked to that user.

Usernames for new OAuth users are auto-derived from their email at account creation.

## Alternatives considered
**Official Auth.js Drizzle adapter** — rejected because it prescribes its own `users`/`accounts`/`sessions`/`verificationTokens` table shapes that conflict with app-specific columns already on `users`.

**Custom OAuth implementation** — rejected because Apple Sign In requires a JWT-signed client secret (expires every 6 months) and managing the full OAuth redirect/PKCE dance is error-prone without meaningful benefit.

**Keep hand-rolled sessions for password login, use Auth.js only for OAuth** — rejected because running two parallel session systems creates edge cases when a user has both credential and OAuth login methods.

## Consequences
- All server components and API routes that call `getSessionUser()` must be updated to use Auth.js's `auth()` or `getServerSession()`.
- Apple Sign In requires a private key and a 6-month-expiring client secret; this must be managed in environment config and rotated proactively.
