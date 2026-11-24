# ADR 0032: Invite-only access, checked against the database on every request

## Status
Accepted (2026-11-18)

## Context
People started signing up for Forkful with no outreach. Steve wants them on a Waitlist and only Invited Users able to use account features, with the lock applying immediately to people already signed in. Sessions are Auth.js JWT cookies (ADR-0001) that last up to 30 days and are never re-checked against the database. `proxy.ts` only checks that a session cookie is present, and its matcher skips `/api`, where each route calls `getSessionUser()`. Google sign-in (and Apple, when it is added) creates a User automatically.

## Decision
- Access is an Invite tied to an email address, stored in its own table. The admin (`ADMIN_USER_ID`) always has access.
- A User's access is derived from their email having an Invite. No status flag on `users` is copied from the Invite, and `dateDeleted` is not reused.
- `getSessionUser()` checks the database on every call and returns no session user for a Waitlisted User. Every API route that already depends on it is therefore locked without route-by-route changes. `proxy.ts` redirects account pages to `/waitlist` for Waitlisted Users.
- Uninvited sign-ups create a Waitlist Entry in its own table, never a User. This applies to the sign-up form, `POST /api/users` and the OAuth `signIn` callback.
- Email/password sign-up for an invited email requires the Invite's single-use code. Google sign-in (and Apple, when it is added) doesn't, because the provider has already verified the email.
- Public pages (marketing, blog, legal, public Recipes and their Signup Wall) are outside the lock.

## Considered Options
- **Access flag in the JWT, checked in the proxy:** rejected. Revoking or locking would wait until the token is refreshed or expires (up to 30 days), and the proxy doesn't cover `/api`.
- **Short JWT lifetime (for example 5 minutes):** rejected. Locking is still delayed, and forced refreshes add complexity and sign-in churn.
- **Keeping uninvited sign-ups as locked Users:** rejected. It stores passwords and OAuth links for accounts that may never be used, and keeps more personal data than an email on a list.
- **Invite codes not tied to an email:** rejected. They can be forwarded, and they don't fit Google sign-in (and Apple, when it is added).
- **Reusing `dateDeleted` for locked users:** rejected. It would put them on the Account Deactivation path, including the warning email and auto-deletion after 12 months (ADR-0007).

## Consequences
- Each authenticated request adds one indexed lookup (Invite by email, or a join). Watch `getSessionUser` latency in Sentry traces.
- Lifting the lock later (open sign-up) means making the access check always pass, then dropping the requirement. The Invite and Waitlist tables can stay.
- For the iOS app, the same check must apply to token-based sessions when they arrive.
- The schema change is additive (two new tables), per ADR-0031.

## Amendment: a Vercel flag switches the lock (#374, 2026-11-24)
- One boolean Vercel flag, `invite-only-access`, decides the mode: on (the default) is the waitlist mode above; off is open sign-up, as before the waitlist. If the flag can't be read, the app stays in waitlist mode (fails closed).
- `isInviteOnly()` in `src/lib/inviteOnly.ts` is the only reader. `hasAccess` and `emailHasInvite` return true when it is off, which covers `getSessionUser`, the proxy lock, credential sign-in and OAuth. `POST /api/users` then needs no Invite or code and sends the "New user signed up" admin email, and `/waitlist` redirects to `/create-account`. `/waitlist/leave` and the stored Invites and Waitlist Entries are untouched.
- The sign-up CTAs (Signup Wall, nav, footer, Home) take the value as a prop from the root layout; no client fetches the flag. The root layout is already `force-dynamic` (it reads the session), so no page lost static caching.
- `INVITE_ONLY_ACCESS` overrides the flag for local development and Preview, and fails closed: when set and non-empty, only the exact string `false` opens sign-up. It is ignored when `VERCEL_ENV` is `production`, so production reads only the Vercel flag.
- Users created in open mode have no Invite. If the flag goes back on, they are locked into the waitlisted state until someone invites them.
