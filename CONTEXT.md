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

## Password Reset Token
A cryptographically random, single-use token issued to a Credential User who has forgotten their password. Stored as a hash in the DB (never the raw value), valid for 1 hour, and marked used on redemption rather than deleted. Sent to the user's email as a link to the Reset Password Page.
_Avoid_: reset link, reset code

## Password Age
The elapsed time since a Credential User last set or changed their password, tracked via `passwordChangedAt` on the `users` table. Set at account creation and updated on every successful password change.
_Avoid_: password expiry, password timestamp

## Forced Password Reset
A session state (`needsPasswordReset: true`) applied to a Credential User whose Password Age exceeds 90 days. Detected in the Auth.js JWT callback and enforced by middleware, which redirects all routes to the Reset Password Page until the user completes a reset.
_Avoid_: password expiry, password timeout, mandatory reset

## Reset Password Page
A single page (`/reset-password`) that handles two modes: (1) token mode — an unauthenticated user arriving via a Password Reset Token link; (2) forced mode — an authenticated user in a Forced Password Reset state. The form is identical in both modes; the backend call differs.
_Avoid_: forgot password page, change password page

## Recipe
A user-created cooking instruction set. Has a name, a Description, a Meal type, an optional Cuisine Type, optional Dietary Tags, optional prep/cook/total times, an optional Serves count, an ordered list of Recipe Steps, and an Ingredient list. Can be private (draft) or public+published (visible to all).

## Serves
The number of portions a Recipe yields. Optional and nullable. When set, enables Per-Serving Nutrition display. Minimum value of 1.

## Recipe Nutrition Panel
A panel shown at the bottom of the Ingredients tab summarising the five core macros (calories, protein, carbs, fat, fiber) summed across all ingredients. When Serves is set, defaults to showing Per-Serving Nutrition with a toggle to switch to total. When Serves is not set, shows totals only.

## Per-Serving Nutrition
The total macro values for a Recipe divided by Serves. Shown by default in the Recipe Nutrition Panel when Serves is set. The user may toggle to view totals instead; this preference is not persisted.

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

## Food
A nutritional item in the library. Has a name, macro values (calories, protein, carbs, fat, fiber), a Serving Size, a Serving Unit, and a Measurements list. Can be created manually or imported from Open Food Facts. Shared across recipes, ingredients, and pantry items.

## Serving Unit
The unit in which a Food's nutrition data is anchored. Required in practice — the application always provides a value, though the column is not DB-constrained non-null. Defines what the Serving Size number means (e.g. `servingSize: 100, servingUnit: 'g'` means all nutrition values are per 100g). Belongs to exactly one unit category: mass, volume, or custom. Changing the Serving Unit within the same category automatically recalculates Serving Size to preserve calorie density. Cross-category changes are blocked.

## Serving Size
The quantity of a Food (in its Serving Unit) that the nutrition values correspond to. Required. Always a positive number.

## Measurement
A unit in which a Food can be expressed when added to a Recipe ingredient or tracked in the Pantry. Each Food has an explicit, author-curated list of Measurements. A Measurement is either a Standard Unit or a Calibrated Custom Unit. The Serving Unit is always included in a Food's Measurements.

## Standard Unit
A mass unit (g, kg, oz, lb, mg) or volume unit (ml, l, cup, Tbs, tsp, fl-oz). Standard Units within the same category are mutually convertible using fixed conversion factors. A Food may only have Standard Units in the same category as its Serving Unit.

## Custom Unit
A Measurement that is not a Standard Unit (e.g. slice, piece, loaf, can). Custom Units are food-specific and not mutually convertible. A Custom Unit becomes a Calibrated Custom Unit when a gram-weight per unit is defined for that Food. Custom Units with calibration are only available on Foods whose Serving Unit is a mass unit.

## Calibrated Custom Unit
A Custom Unit on a Food that has a defined gram-weight (e.g. "1 slice = 30g"). Enables automatic calorie calculation when that unit is used in a Recipe ingredient or Pantry entry. Only valid on Foods with a mass Serving Unit.

## Uncalibrated Custom Unit
A Custom Unit on a Food that has no gram-weight defined. Calorie calculation returns zero when this unit is used in an ingredient. Flagged with a warning in the Food editor.

## Ingredient
A Food used in a Recipe, expressed as a quantity in a chosen Measurement. Calories are computed at load time from the Food's current nutrition data and the ingredient's quantity and unit. The `ingredients` table currently retains a `calories` column; that column will be removed once the `feat/serving-unit-refinement` migration lands, at which point calories will be fully derived and not stored. If the chosen unit is an Uncalibrated Custom Unit, the computed calories are zero.

## Nutrition Complete
A Recipe in which every Ingredient's calories can be fully calculated — i.e. no ingredient uses an Uncalibrated Custom Unit. Stored as a boolean on the Recipe and recomputed whenever the Recipe's ingredients are saved. Nutrition Complete status is used as a binary ranking signal: in public recipe discovery, Nutrition Complete recipes always rank above incomplete ones, regardless of the active sort order.

## Pantry Item
A Food tracked as physical stock. Has an original size and a current size, each expressed as a quantity in a chosen Measurement from the Food's Measurements list. Units are constrained to the Food's Measurements — the same vocabulary used by Recipe ingredients.
