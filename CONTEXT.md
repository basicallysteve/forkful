# Forkful Domain Glossary

## User
A registered person with an account. Identified internally by a numeric `id`. Has a `username` (unique, human-readable), an `email`, and optionally a `password` (null for OAuth-only users).

## Credential User
A User who registered via username and password. Can log in with their credentials.

## OAuth User
A User who registered via an external identity provider (Google or Apple). Has no password. Identified by one or more linked OAuth Accounts.

## OAuth Account
A link between a User and an external identity provider. Stores the provider name (`google`, `apple`) and the provider's subject ID (`providerAccountId`). A User may have multiple OAuth Accounts (one per provider).

## Account Linking
When an OAuth sign-in arrives with an email matching an existing User, the OAuth Account is silently linked to that User and the sign-in succeeds. No error is shown to the user.

## Username
A unique, human-readable handle for a User. Derived automatically from the user's email at account creation (e.g. `jane.doe@gmail.com` → `janedoe`). Users may change it later in their profile. Never null.

## Session
An authenticated context identifying the current User. Managed by Auth.js. Replaces the previous hand-rolled JWT cookie system.
