# Account closure flow

How a User closes their account: reversible Account Deactivation, permanent Account Deletion, reactivation, and the 12-month automatic deletion of deactivated accounts. Covers `account_feedback` (and the `users.dateDeleted` and `deactivation_warning_email_sent_at` columns it relates to). Decision record: ADR-0007.

Last verified: 2026-11-25, against 524861d

Key code: `src/views/Profile/Profile.tsx` (`confirmClosure`), `app/api/users/[id]/feedback/route.ts`, `app/api/users/[id]/route.ts` (actions `deactivate`, `delete`), `app/api/auth/reactivate/route.ts`, `app/api/cron/deactivated-accounts/route.ts`, `src/lib/users.ts` (`createAccountFeedback`, `deactivateAccount`, `reactivateAccount`, `deleteAccount`, `processDeactivatedAccounts`), `src/lib/waitlist.ts` (`leaveWaitlist`), `src/auth.ts`, `vercel.json` (cron).

## Closing, reactivating and deleting

```mermaid
flowchart TD
    Start(["User opens the Profile closure dialog"]) --> Choose{"Deactivate or delete?"}
    Choose --> Reasons["Pick reasons and an optional comment"]
    Reasons --> Fb["POST /api/users/id/feedback<br/>(own id only, else 403)"]
    Fb --> FbValid{"Action deactivated or deleted,<br/>reasons from the fixed list,<br/>comment a string?"}
    FbValid -->|"No"| Fb400["400, the dialog shows the error<br/>and nothing is closed"]
    FbValid -->|"Yes"| FbInsert["Insert account_feedback:<br/>userId (plain integer, no FK), action,<br/>reasons, comment"]
    FbInsert --> FbEvt["feedback admin event (after the response)"]
    FbEvt --> Which{"Which closure?"}

    Which -->|"Deactivate"| Deact["PATCH /api/users/id action deactivate"]
    Deact --> SetDate["deactivateAccount: users.dateDeleted = now<br/>(soft delete, data kept)"]
    SetDate --> Bye1["Goodbye email, action deactivated<br/>(always sent, transactional)"]
    Bye1 --> DeactEvt["account-deactivated admin event"]
    DeactEvt --> SignOut

    Which -->|"Delete"| Del["PATCH /api/users/id action delete"]
    Del --> DeleteAcc["deleteAccount (see below)"]
    DeleteAcc --> Bye2["Goodbye email, action deleted"]
    Bye2 --> DelEvt["account-deleted admin event (no user id)"]
    DelEvt --> SignOut(["signOut, back to /"])

    SetDate -.->|"user signs in again"| Login["Credentials login or OAuth sign-in"]
    Login --> Kind{"Which sign-in?"}
    Kind -->|"Credentials: right password,<br/>dateDeleted set"| Err["ACCOUNT_DEACTIVATED error,<br/>Login shows the reactivation prompt"]
    Err --> Confirm["User confirms: POST /api/auth/reactivate"]
    Confirm --> RCheck{"Under 5 failed attempts in the last hour<br/>for the IP and the user,<br/>password matches, account deactivated?"}
    RCheck -->|"No"| RFail["429, 400 or 401, failed attempt logged"]
    RCheck -->|"Yes"| React["reactivateAccount: dateDeleted = null,<br/>deactivationWarningEmailSentAt = null"]
    React --> Back(["User signs in normally"])
    Kind -->|"OAuth with access"| OReact["resolveOAuthSignIn calls reactivateAccount<br/>immediately, no extra prompt"]
    OReact --> Back
```

## Account deletion and the 12-month cleanup

```mermaid
flowchart TD
    Cron(["Vercel cron: 03:00 on the 1st and 15th<br/>GET /api/cron/deactivated-accounts"]) --> Auth{"Bearer CRON_SECRET matches?"}
    Auth -->|"No"| R401["401"]
    Auth -->|"Yes"| Proc["processDeactivatedAccounts"]

    Proc --> Old["Users with dateDeleted 365 days ago or older"]
    Old --> DeleteAcc
    Proc --> Warn["Users deactivated 335 to 364 days ago<br/>with no warning sent yet"]
    Warn --> Claim["UPDATE deactivationWarningEmailSentAt = now<br/>WHERE it is still null (claim before sending)"]
    Claim --> Won{"Row claimed?"}
    Won -->|"No: another run took it"| Skip["Skip"]
    Won -->|"Yes"| Warning["Deactivation Expiry Warning email<br/>with the deletion date (dateDeleted + 365 days)"]

    DeleteAcc["deleteAccount(userId)"] --> Tx["Transaction"]
    Tx --> Priv["Hard-delete the user's recipes that are private<br/>or were never published"]
    Priv --> UserRow["Hard-delete the users row"]
    UserRow --> Cascade["FK cascade removes pantry_items, oauth_accounts,<br/>password_reset_tokens, login_attempts, and other child rows"]
    UserRow --> Anon["FK set null: published public recipes<br/>keep existing with userId null (anonymised)"]
    Cascade --> Kept["account_feedback rows stay<br/>(no FK, userId is just a number)"]
    Anon --> Kept
```

## Notes

- The Profile dialog saves feedback first, then closes the account; if feedback validation fails the account is not closed. The feedback route is authenticated, so the order matters: after deletion the session is gone.
- `deactivateAccount` is also called by the waitlist "leave" flow (`leaveWaitlist`) and `deleteAccount` by the cron; only the Profile PATCH route records the `account-deactivated` and `account-deleted` admin events.
- Goodbye emails are sent whatever the Marketing Email Opt-in is; failures are swallowed so they never fail the closure.
- A deactivated User's recipes, pantry and log stay in the database but the account cannot sign in until reactivated. The access check (`hasAccess`) is separate and described in `invite-waitlist-signup.md`.
