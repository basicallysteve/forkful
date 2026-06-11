# ADR 0006 — Password reset flow and 90-day enforcement

## Status
Accepted

## Context
Credential Users need a way to reset a forgotten password, and the app must enforce a 90-day password rotation policy. OAuth Users have no password and must be told to sign in with their provider instead.

## Decisions

**Token storage — DB-backed, not stateless JWT.**
Password Reset Tokens are stored as SHA-256 hashes in a `password_reset_tokens` table with `userId`, `tokenHash`, `expiresAt`, and `usedAt`. Tokens expire after 1 hour and are marked used on redemption rather than deleted, so replayed tokens fail gracefully. A stateless signed JWT was rejected because it cannot be invalidated — if a user changes their password via another path (e.g. profile settings), a previously issued reset link would still work until expiry.

**Reset Password Page — two modes, one route.**
`/reset-password` handles both the email-triggered flow (unauthenticated, token in query param) and the 90-day forced flow (authenticated session with `needsPasswordReset: true`). The form is identical; the backend call differs. Two separate routes were rejected to avoid maintaining near-duplicate pages.

**90-day enforcement — JWT callback + proxy.ts.**
The Auth.js `jwt` callback sets `needsPasswordReset: true` when `passwordChangedAt` is older than 90 days. `proxy.ts` (the project's edge middleware equivalent) intercepts all routes for flagged sessions and redirects to `/reset-password`. This follows the same pattern as `needsOnboarding`.

**Existing users — backfill `passwordChangedAt` with `dateAdded`.**
The `passwordChangedAt` column is new. Existing Credential Users have `null` after the migration; the migration backfills them with `dateAdded` as a reasonable proxy for when their password was first set. Treating `null` as "never changed" was rejected as it would force all existing users to reset on their next login.

**OAuth User feedback — inline, provider-named.**
When an OAuth User submits their email on `/forgot-password`, the page shows an inline message naming their specific provider (looked up via `oauth_accounts`). No email is sent. Generic "social sign-in" messaging was rejected in favour of naming the provider for clarity.

**Email provider — Resend.**
Transactional password reset emails are sent via Resend. Chosen for its Next.js/Vercel integration, free tier (3 000 emails/month), and minimal setup overhead.

## Consequences
- `users` table gains `passwordChangedAt timestamp`.
- New `password_reset_tokens` table required (migration needed).
- `proxy.ts` gains a `needsPasswordReset` check alongside the existing session guard.
- `passwordChangedAt` must be updated on every successful password change across all paths: forgot-password reset, forced reset, and profile password change.
