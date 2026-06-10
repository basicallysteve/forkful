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

## First-Time OAuth User
An OAuth User whose `onboardingCompletedAt` is null. Shown the Welcome Page once after their first sign-in. After completing or skipping onboarding, `onboardingCompletedAt` is set and the Welcome Page is never shown again.

## Welcome Page
A one-time setup page shown to First-Time OAuth Users after their first sign-in. Lets the user set Cuisine Preferences and Dietary Restrictions. Can be skipped. Submitting or skipping sets `onboardingCompletedAt`.

## Cuisine Preferences
A list of cuisine types a User is interested in (e.g. Italian, Mexican). Optional. Set during onboarding or on the profile page. Used to surface matching public recipes in the For You section.

## Dietary Restrictions
A list of dietary constraints a User has (e.g. vegan, gluten-free). Optional. Set during onboarding or on the profile page. Applied as a hard filter on the recipes list by default; the user may toggle this filter off for a browsing session.

## Session
An authenticated context identifying the current User. Managed by Auth.js. Replaces the previous hand-rolled JWT cookie system.

## Recipe
A user-created cooking instruction set. Has a name, a Description, a Meal type, an optional Cuisine Type, optional Dietary Tags, optional prep/cook/total times, an ordered list of Recipe Steps, and an Ingredient list. Can be private (draft) or public+published (visible to all).

## Description
A short summary field on a Recipe. Used for preview cards and SEO. Distinct from Recipe Steps — it is not procedural instruction.

## Recipe Steps
An ordered list of discrete instructions belonging to a Recipe. Each step has an optional title, a rich-text body (HTML), and optionally one or more images stored on Vercel Blob. Steps are reordered via up/down controls in the editor.

## Cuisine Type
A single cuisine classification on a Recipe (e.g. "Italian", "Mexican"). Optional. Set manually by the recipe author from a fixed list (`cuisineOptions`). Used to match against a User's Cuisine Preferences in the For You section.

## Dietary Tags
A set of dietary classifications on a Recipe (e.g. `["vegan", "gluten-free"]`). Optional. Set manually by the recipe author from a fixed list (`dietaryOptions`). Used to enforce the Dietary Restriction filter on the recipes list.

## For You Section
A section at the top of the recipes list page, visible only to logged-in Users who have at least one Cuisine Preference set. Shows up to 5 public, published Recipes whose Cuisine Type matches any of the user's Cuisine Preferences. Acts as a discovery feature for other authors' recipes.

## Dietary Restriction Filter
A default hard filter applied to the recipes list for logged-in Users with Dietary Restrictions set. Hides recipes whose Dietary Tags do not cover all of the user's restrictions (recipes with no Dietary Tags are always shown). The user can toggle this filter off for the current browsing session; the toggle does not persist.
