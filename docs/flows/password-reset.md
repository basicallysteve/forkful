# Password reset flow

How a forgotten password is reset by email, and how the 90-day rotation forces a reset for a signed-in credentials User. Covers `password_reset_tokens` (and the `login_attempts` rate limit). Decision record: ADR-0006.

Last verified: 2026-11-25, against 524861d

Key code: `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`, `src/lib/users.ts` (`checkPasswordResetRateLimit`, `createPasswordResetToken`, `redeemPasswordResetToken`, `forceResetPassword`, `getOAuthProvidersForEmail`), `src/auth.ts` (`isPasswordExpired`, `jwt` callback), `proxy.ts`.

## Reset by email link

```mermaid
flowchart TD
    Start(["Visitor submits email on /forgot-password"]) --> Post["POST /api/auth/forgot-password"]
    Post --> Limit{"Under 3 reset requests in the last hour<br/>for this IP?<br/>(login_attempts: successful 1, userId null)"}
    Limit -->|"No"| R429["429 Too many requests"]
    Limit -->|"Yes"| Track["Insert login_attempts row for the IP<br/>(counts toward the limit, even for unknown emails)"]
    Track --> Valid{"Email present, 254 chars or fewer,<br/>contains @?"}
    Valid -->|"No"| R400["400 A valid email is required"]
    Valid -->|"Yes"| Create["createPasswordResetToken(email lowercased)"]
    Create --> Found{"Active user with a password?<br/>(dateDeleted null)"}
    Found -->|"Yes"| Clean["Delete this user's tokens that are used or expired"]
    Clean --> Insert["Insert password_reset_tokens:<br/>SHA-256 tokenHash, expiresAt now + 1 hour,<br/>usedAt null (raw token is 32 random bytes, never stored)"]
    Insert --> Mail["Send email with<br/>AUTH_URL/reset-password?token=..."]
    Mail --> Ok["200 type success"]
    Found -->|"No"| Oauth{"Email belongs to an OAuth-only user?<br/>(oauth_accounts providers)"}
    Oauth -->|"Yes"| OauthMsg["200 type oauth + provider names<br/>(no email sent)"]
    Oauth -->|"No: unknown email"| Ok

    Ok --> Click(["User opens the link on /reset-password"])
    Click --> Reset["POST /api/auth/reset-password<br/>token + newPassword"]
    Reset --> Strong{"Password has 8+ chars, upper, lower,<br/>number and special character?"}
    Strong -->|"No"| R400b["400 password rules message"]
    Strong -->|"Yes"| Tx["redeemPasswordResetToken in a transaction"]
    Tx --> Claim["UPDATE password_reset_tokens SET used_at = now<br/>WHERE token_hash matches, used_at IS NULL, expires_at >= now"]
    Claim --> Claimed{"Row claimed?"}
    Claimed -->|"No: unknown, used or expired"| Invalid["400 Invalid or expired reset link"]
    Claimed -->|"Yes"| Same{"New password equals current one?"}
    Same -->|"Yes"| Rollback["400 must differ; transaction rolls back,<br/>token stays unused"]
    Same -->|"No"| Update["UPDATE users SET password, passwordChangedAt = now"]
    Update --> Done(["200 type success"])
```

## Forced reset after 90 days

```mermaid
flowchart TD
    Login(["Credentials sign-in"]) --> Jwt["Auth.js jwt callback reads users.passwordChangedAt"]
    Jwt --> Old{"Older than 90 days?"}
    Old -->|"No"| Normal(["Session works normally"])
    Old -->|"Yes"| Flag["token.needsPasswordReset = true"]
    Flag --> Proxy["proxy.ts redirects pages to /reset-password<br/>(login, forgot-password, /api/auth, logout are exempt)"]
    Proxy --> Form["User submits new password<br/>POST /api/auth/reset-password (no token)"]
    Form --> Auth{"getSessionUser() has needsPasswordReset?"}
    Auth -->|"No"| R401["401 Unauthorized"]
    Auth -->|"Yes"| Force["forceResetPassword: reject same password,<br/>UPDATE users SET password, passwordChangedAt = now"]
    Force --> Refresh["Client session update with passwordChangedAt:<br/>jwt callback sets needsPasswordReset = false"]
    Refresh --> Normal
```

## Notes

- ADR-0006 says tokens are marked used rather than deleted. That holds at redemption, but the next reset request for the same user deletes that user's used and expired tokens. Unused, unexpired tokens from earlier requests stay valid until they expire or are used.
- Only credentials sign-in sets `needsPasswordReset`; OAuth sign-in never does (OAuth-only Users have no password).
- OAuth-only Users get a provider message and no email, so that response differs from the unknown-email response; this is as ADR-0006 decided.
