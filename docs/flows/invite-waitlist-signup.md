# Invite, waitlist and sign-up flow

How an email gets from the public Waitlist to an Invite, and how an Invite becomes a User through the sign-up form or OAuth. Covers `waitlist_entries`, `invites`, `oauth_accounts` and `login_attempts`. Decisions are in ADR-0032 (invite-only access, amended by #374 for the `invite-only-access` flag); domain terms (Waitlist Entry, Invite, Waitlisted User) are in `CONTEXT.md`.

Last verified: 2026-11-25, against 524861d

Key code: `src/lib/inviteOnly.ts` (`isInviteOnly`), `src/lib/access.ts` (`hasAccess`, `emailHasInvite`), `src/lib/waitlist.ts`, `src/lib/invites.ts`, `src/lib/waitlistResponse.ts`, `src/lib/oauthSignIn.ts`, `src/lib/oauth.ts`, `src/auth.ts`, `src/lib/users.ts` (`login`, `trackLoginAttempt`), `app/api/users/route.ts`, `app/api/waitlist/`, `app/api/admin/waitlist/`.

## Joining the waitlist and being invited

```mermaid
flowchart TD
    Visitor([Visitor gives an email]) --> Entry{"Which entry point?"}
    Entry -->|"Waitlist form"| PostWaitlist["POST /api/waitlist"]
    Entry -->|"Sign-up form"| PostUsers["POST /api/users"]
    Entry -->|"Google or Apple sign-in"| OAuthPath["resolveOAuthSignIn<br/>(see OAuth below)"]

    PostUsers --> Flag{"isInviteOnly()?<br/>flag invite-only-access,<br/>fails closed to on"}
    Flag -->|"Off: open sign-up"| OpenSignUp["openSignUp:<br/>signUp creates the User,<br/>admin email sent"]
    Flag -->|"On"| HasInvite{"Invite for this email?"}
    HasInvite -->|"No"| Join
    HasInvite -->|"Yes"| RedeemPath["Redeem code<br/>(see Sign-up below)"]

    PostWaitlist --> Join["respondJoinWaitlist"]
    Join --> Insert["joinWaitlist: insert waitlist_entries<br/>(email lowercased, ON CONFLICT DO NOTHING)"]
    Insert --> Created{"New entry?"}
    Created -->|"Yes"| Notify["Admin notification email<br/>(sent after the response)"]
    Created -->|"No: duplicate"| Same
    Notify --> Same["Same response either way: ok true<br/>(never reveals invited, waitlisted or has account)"]

    Same --> AdminList["Admin: GET /api/admin/waitlist<br/>lists entries plus entry-less invites"]
    AdminList --> Invite["Admin: POST /api/admin/waitlist/invites<br/>with entryId or email"]
    Invite --> CreateInvite["createInvite: generate 256-bit code,<br/>insert invites row with SHA-256 codeHash"]
    CreateInvite --> Dup{"Already invited?"}
    Dup -->|"Yes"| Conflict["409 Already invited"]
    Dup -->|"No"| SendEmail["Send invite email with the code<br/>(10 s timeout, failure does not roll back)"]
    SendEmail --> Once["201 returns the raw code once,<br/>Cache-Control no-store"]

    AdminList --> Revoke["Admin: revoke invite<br/>revokeInvite deletes the row"]
    Revoke --> Locked["hasAccess false on the user's next request<br/>(nothing is cached)"]
    AdminList --> DelEntry["Admin: delete entry<br/>never touches a User or an Invite"]
```

## Sign-up with an Invite, and the access check

```mermaid
flowchart TD
    Submit["POST /api/users<br/>email, username, password, code"] --> Lookup["getInviteByEmail"]
    Lookup --> Valid{"Username 3+ chars,<br/>password 8+ chars?"}
    Valid -->|"No"| Bad400["400 with the field error"]
    Valid -->|"Yes"| Check{"Invite exists, code unused,<br/>constant-time hash match?"}
    Check -->|"No"| Invalid["400 invalid_invite<br/>(same message for wrong, used or missing code)"]
    Check -->|"Yes"| Tx["Transaction"]
    Tx --> Redeem["UPDATE invites SET code_used_at<br/>WHERE id and code_used_at IS NULL"]
    Redeem --> Won{"Row updated?"}
    Won -->|"No: concurrent request won"| Invalid
    Won -->|"Yes"| Create["signUp inserts users row<br/>(bcrypt password, passwordChangedAt now)"]
    Create --> Taken{"Insert fails, e.g. username taken?"}
    Taken -->|"Yes"| Rollback["Transaction rolls back,<br/>code stays unused, 400"]
    Taken -->|"No"| Done["201 User created,<br/>invite-accepted admin event recorded"]

    Done --> Login["Credentials login: authorize()"]
    Login --> Rate{"login(): under 5 failed attempts<br/>in the last hour for the IP and for the user?"}
    Rate -->|"No"| Limited["Error: too many failed attempts"]
    Rate -->|"Yes"| Pass{"Username and password match?"}
    Pass -->|"No"| Fail["login_attempts row: successful 0<br/>Invalid username or password"]
    Pass -->|"Yes"| Access{"hasAccess(userId)?<br/>admin, flag off, or an Invite for the email"}
    Access -->|"No"| Waitlisted["WaitlistedError: no session,<br/>Waitlisted User sees /waitlist"]
    Access -->|"Yes"| Ok["login_attempts row: successful 1<br/>session issued"]
```

## OAuth sign-in

```mermaid
flowchart TD
    Start(["Google or Apple callback"]) --> Verified{"email_verified explicitly false?"}
    Verified -->|"Yes"| Deny["Denied (false)"]
    Verified -->|"No or absent"| Existing{"Existing account?<br/>by oauth_accounts link, else by email"}

    Existing -->|"Yes"| Acc{"hasAccess?"}
    Acc -->|"No: Waitlisted User"| ToWait["Redirect to /waitlist, no session"]
    Acc -->|"Yes"| Link["Link provider if new (oauth_accounts),<br/>reactivate if deactivated"]
    Link --> In(["Signed in"])

    Existing -->|"No"| HasEmail{"Email present?"}
    HasEmail -->|"No: Apple omits it"| Deny
    HasEmail -->|"Yes"| Inv{"emailHasInvite?<br/>(true for everyone when flag is off)"}
    Inv -->|"Yes: no code needed"| Create["findOrCreateOAuthUser:<br/>users row (password null) + oauth_accounts row"]
    Create --> Evt["invite-accepted admin event<br/>(only if an Invite exists)"]
    Evt --> In
    Inv -->|"No"| Wl["joinWaitlist: one waitlist_entries row,<br/>no users or oauth_accounts row"]
    Wl --> WlMail["Admin notification if the entry is new"]
    WlMail --> ToWait
```

## Notes

- A Waitlist Entry never creates a User, and a User never gets a status copied from an Invite. Access is derived from "this email has an Invite" on every request (`getSessionUser` and `proxy.ts` both call `hasAccess`).
- Invites never expire and the code is single-use; Google and Apple sign-in skip the code because the provider already verified the email.
- The sign-up route decides "no Invite" before it looks at the username or password, so an uninvited email always gets the waitlist response.
- A "leave the waitlist" link (`/waitlist/leave`, `app/api/waitlist/leave`) deletes the entry and deactivates a Waitlisted User with no Invite; it is not drawn here.
- `login_attempts` also records password-reset requests (rows with `successful` 1 and no user); see `password-reset.md`.
