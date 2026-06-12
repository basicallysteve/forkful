# ADR 0007: Account Closure Design

## Status
Accepted

## Context
Users need two ways to close their account: reversible deactivation and permanent deletion. The main architectural question for deletion was what to do with public recipes — cascade-deleting them would silently break content other users have discovered, while anonymising them preserves the content without retaining personal data.

## Decision
**Two distinct closure paths:**

1. **Account Deactivation** — sets `dateDeleted` on the user row (soft delete). All data is preserved. Reactivation requires an explicit confirmation step after re-authenticating; valid credentials alone do not restore access.

2. **Account Deletion** — immediate hard delete of the user row and all associated private data (private recipes, pantry items, OAuth accounts, password reset tokens, login attempts). No grace period. Public recipes are anonymised (author foreign key set to null) rather than deleted.

## Consequences
- The `recipes` table must allow a nullable `userId` to support anonymised authorship.
- The `account_feedback` table stores `userId` as a plain integer with no foreign key constraint, since the user row is gone by the time deletion feedback would be queried.
- A goodbye email is always sent regardless of the user's Marketing Email Opt-in status — it is transactional, not promotional.
- Deactivated users attempting to log in must see an explicit reactivation prompt rather than being silently restored.
- A background job must periodically find users where `dateDeleted` is older than 12 months and promote them to full Account Deletion (same rules: anonymise public recipes, hard-delete everything else).
- A Deactivation Expiry Warning email is sent at ~11 months of deactivation (30 days before the deletion job would fire). It is transactional and sends regardless of Marketing Email Opt-in status.
