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
A unique, human-readable handle for a User. Derived automatically from the user's email at account creation (e.g. `jane.doe@gmail.com` → `janedoe`). Users may change it later in their profile. Must be 3–30 characters, alphanumeric (upper and lowercase) with hyphens and underscores allowed, no spaces. Never null.

## Account Deactivation
A reversible closure of a User's account. Sets `dateDeleted` on the user row; the user cannot log in while deactivated. All data (recipes, pantry items) is preserved. Reactivation requires an explicit confirmation step — valid credentials alone do not automatically restore access. If a User remains deactivated for 12 months without reactivating, their account is automatically promoted to Account Deletion by a background job.
_Avoid_: suspension, soft delete (that term is reserved for content entities)

## Deactivation Expiry Warning
A transactional email sent to a deactivated User approximately 30 days before their account is eligible for automatic Account Deletion (i.e. at ~11 months of deactivation). Sent regardless of Marketing Email Opt-in status. The email states the scheduled deletion date and provides a link to reactivate.
_Avoid_: deletion warning, expiry notice

## Account Deletion
A permanent, irreversible closure of a User's account. Hard-deletes the user row, all private recipes, pantry items, OAuth accounts, password reset tokens, and login attempts. Public recipes are anonymised (author set to null) rather than deleted. No grace period. Preceded by a confirmation modal and Account Closure Feedback collection.
_Avoid_: deactivation, account removal

## Account Closure Feedback
Structured feedback collected in-app immediately before a User completes Account Deactivation or Account Deletion. Consists of one or more predefined reasons (e.g. "Not using it enough", "Missing features", "Privacy concerns", "Switching to another app") plus an optional free-text comment. Stored in the `account_feedback` table. Always optional for the user to provide. The UI is a PrimeReact `Dialog` modal.
_Convention_: all modal dialogs in the app use the PrimeReact `Dialog` component. Custom `modal-overlay` / `modal` DOM structures are not used.

## Goodbye Email
A transactional email sent to a User upon Account Deactivation or Account Deletion. Always sent regardless of the User's Marketing Email Opt-in status. Distinct from marketing or digest emails.

## Marketing Email Opt-in
A boolean preference on a User indicating whether they consent to receive marketing and news emails. Defaults to false (opt-out). Must be explicitly enabled by the user. Surfaced at three points: the sign-up form (Credential Users), the Welcome Page (OAuth Users), and the profile page (all Users). Does not gate transactional emails (e.g. Goodbye Email, password reset).
_Avoid_: email subscription, newsletter opt-in

## Recipe Suggestion Email Frequency
A preference on a User controlling how often they receive recipe suggestion digest emails. Values: `never` | `weekly` | `monthly`. Defaults to `weekly`. Sent by the `processRecipeSuggestions` cron job. Suggestions are scored and ranked using three signals: (1) Cuisine Type match against the user's Cuisine Preferences, (2) pantry overlap — recipes that use foods the user currently has in their pantry are boosted, with soonest-expiring pantry foods ranked highest, (3) hard dietary restriction filter — recipes are excluded unless their Dietary Tags cover all of the user's Dietary Restrictions.

## Pantry Expiration Email Frequency
A preference on a User controlling how often they receive pantry expiration reminder emails. Values: `never` | `daily` | `weekly`. Defaults to `weekly`. Sent by the `processPantryReminders` cron job. Daily users receive an email for items expiring within 1 day; weekly users receive an email for items expiring within 7 days, sent every Monday.

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

## Anonymous Visitor
A person browsing Forkful without a Session — not logged in. Can view public Recipes, subject to the Recipe View Limit. Contrast with User.
_Avoid_: guest, anonymous user

## Unlimited Recipe Access
An entitlement to view Recipes without being subject to the Recipe View Limit. Currently held by every registered User and denied to every Anonymous Visitor. Designed as the extension point for a future free/paid tier split: when tiers ship, only paid Users retain this entitlement and free Users fall under the limit.
_Avoid_: premium access, unlimited views

## Recipe View Limit
The maximum number of distinct public Recipes an Anonymous Visitor may fully view within a rolling 30-day window before the Signup Wall appears. Currently 5. Re-viewing an already-seen Recipe does not consume the allowance again. Holders of Unlimited Recipe Access are exempt.
_Avoid_: view quota, metering, paywall count

## Signup Wall
The gated state of a Recipe detail page shown to an Anonymous Visitor who has reached the Recipe View Limit. The Recipe's summary (name, Description, times, Cuisine Type, Dietary Tags, ingredient count, Review Aggregate) remains visible, but its Ingredient list and Recipe Steps are withheld and replaced by a prompt to create a free account. Known web crawlers are exempt (see Crawler Exemption).
_Avoid_: paywall, registration wall, content gate

## Crawler Exemption
A carve-out whereby requests from recognised search-engine crawlers bypass the Recipe View Limit and always receive the full Recipe, so public Recipes remain indexable despite the Signup Wall.
_Avoid_: bot allowlist, SEO bypass

## Recipe View Count
A running tally of how many times a public Recipe's detail page has been viewed, stored as a single denormalised integer on the Recipe and surfaced as a popularity signal. Counts both Anonymous Visitor and User views — including views that land on the Signup Wall — but excludes views by the Recipe's own author. Distinct from the Recipe View Limit: Recipe View Count measures a *Recipe's* popularity (per-recipe), whereas the Recipe View Limit meters an *Anonymous Visitor's* own consumption (per-visitor).
_Avoid_: view metering, hit count, impressions

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

## Recipe Short ID
An opaque, 8-character nanoid assigned to a Recipe at creation time and never changed. Used as the stable lookup key in URLs (`/recipes/[shortId]/[slug]`) and API routes (`/api/recipes/[shortId]`). Not derived from the recipe name. Collision probability is negligible at any realistic recipe count.
_Avoid_: recipe ID (that term refers to the numeric primary key), slug

## Recipe
A user-created cooking instruction set. Has a name, a Description, a Meal type, an optional Cuisine Type, optional Dietary Tags, optional prep/cook/total times, an optional Serves count, an ordered list of Recipe Steps, and an Ingredient list. Can be private (draft) or public+published (visible to all).

## Serves
The number of portions a Recipe yields. Optional and nullable. When set, enables Per-Serving Nutrition display. Minimum value of 1.

## Recipe Nutrition Panel
A panel shown at the bottom of the Ingredients tab summarising the five core macros (calories, protein, carbs, fat, fiber) summed across all ingredients. When Serves is set, defaults to showing Per-Serving Nutrition with a toggle to switch to total. When Serves is not set, shows totals only.

## Per-Serving Nutrition
The total macro values for a Recipe divided by Serves. Shown by default in the Recipe Nutrition Panel when Serves is set. The user may toggle to view totals instead; this preference is not persisted.

## Description
A rich-text (HTML) summary field on a Recipe. Used for preview cards and SEO. Distinct from Recipe Steps — it is not procedural instruction. When rendering in email templates, HTML tags must be stripped to plain text.

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
A generic, canonical nutritional item (e.g. "Chicken Breast"). Has a name, macro values (calories, protein, carbs, fat, fiber), a Serving Size, a Serving Unit, an optional Density, and a Measurements list. Can be created manually or imported from USDA FoodData Central (Foundation Foods or SR Legacy). Used exclusively as the basis for Recipe Ingredients. Not brand-specific and has no barcode. Distinct from a Product. _Exception_: a small number of legacy rows imported from Open Food Facts (before the Food/Product split) remain in the foods table with `source = 'open_food_facts'` and are grandfathered as Foods (see ADR-0008).
_Avoid_: generic food, base food, parent food

## Product
A specific branded, purchasable food item (e.g. "Tyson Boneless Skinless Chicken Breast"). Has a barcode, an optional Density, and a Measurements list. Sourced from Open Food Facts or USDA Branded Foods, or created manually. Optionally linked to a parent Food — the link is not required at the schema level, but the Barcode Creation Modal requires it so the product participates in Meal Preparation Deduction matching. A Product is never used directly as a Recipe Ingredient; only its linked Food (if any) participates in recipes.
_Avoid_: branded food, food product

## Barcode Creation Modal
A modal dialog shown when a barcode scan returns no matching Product. Lets the user create a new Product inline without leaving the pantry item form. The scanned barcode is pre-attached to the new product silently. Contains a single form with: product name, a Food link field (required — labelled "What type of food is this?", gates saving), a "Scan nutrition label" button that invokes Tesseract.js OCR to populate all nutrition fields (calories, protein, carbs, fat, fiber, saturatedFat, sugar, sodium, servingSize, servingUnit) from a photo of the nutrition facts label, and editable nutrition fields the user reviews and corrects before saving. On save, the new product is auto-selected in the ProductSearch and the pantry item form continues normally. The OCR step is optional — the user may enter nutrition fields manually.
_Avoid_: product creation dialog, new product form

## Density
An optional property on a Food or Product expressing how many grams one millilitre of the item weighs (g/ml). When set, enables cross-category unit conversion between mass and volume Measurements. For USDA-imported Foods and Products, auto-derived at import time from USDA Portion Data: if any portion entry has a volume unit and a gram weight (e.g. "1 cup = 128g"), density is calculated from that pair. If no volume portion exists, density is left null. Users may always override the auto-derived value in the editor. Stored as a nullable numeric column on both the `foods` and `products` tables.
_Avoid_: specific gravity, weight per volume

## Serving Unit
The unit in which a Food's nutrition data is anchored. Required in practice — the application always provides a value, though the column is not DB-constrained non-null. Defines what the Serving Size number means (e.g. `servingSize: 100, servingUnit: 'g'` means all nutrition values are per 100g). Belongs to exactly one unit category: mass, volume, or custom. Changing the Serving Unit within the same category automatically recalculates Serving Size to preserve calorie density. Cross-category changes are blocked.

## Serving Size
The quantity of a Food (in its Serving Unit) that the nutrition values correspond to. Required. Always a positive number.

## Measurement
A unit in which a Food can be expressed when added to a Recipe ingredient or tracked in the Pantry. Each Food has an explicit, author-curated list of Measurements stored in the DB. When a Food has a Density set, the full Measurement list presented to the user is expanded at runtime to include Standard Units from the opposite category (mass units for a volume Food, volume units for a mass Food); these cross-category units are derived, not stored. A Measurement is either a Standard Unit or a Calibrated Custom Unit. The Serving Unit is always included in a Food's Measurements. For Foods and Products imported from USDA, Measurements are auto-populated at import time from USDA Portion Data; manually created Foods receive no auto-populated Measurements beyond the Serving Unit.

## AI Completion
A single-turn text-generation call to an LLM: one system prompt (static instructions) plus one user message (dynamic input) in, one string out. All AI Completions go through `complete()` in `src/lib/ai.ts`; no feature imports an LLM SDK directly. The caller selects a named model configuration from `Models` in that module — provider and model name are co-located there, not scattered across features. User-supplied data embedded in the user message must be wrapped in XML tags to defend against prompt injection. Output validation is the caller's responsibility.
_Avoid_: LLM call, Claude call, model call, inference

## USDA Name Normalization
The process of converting a raw USDA food description into a human-readable Food name. Applied at import time for Foundation/SR Legacy Foods (`source = 'usda'`) only — not for Branded Products. The normalized form is title case with comma-separated USDA qualifiers collapsed into a parenthetical suffix (e.g. `"CHICKEN, BREAST, BONELESS, SKINLESS, RAW"` → `"Chicken Breast (boneless, skinless, raw)"`). Performed via a Claude LLM call. If the LLM call fails, the raw USDA description is used as the food name and the failure is logged. The original USDA description is not stored after normalization; `externalId` preserves the link to the source record. A one-time migration script normalizes all existing `source = 'usda'` rows; new imports are normalized inline in `importUSDAFood`.
_Avoid_: name cleaning, name formatting, name sanitization

## USDA Portion Data
Portion descriptions attached to a USDA food record (e.g. "1 slice = 28g", "1 loaf = 567g"), available via the USDA full food detail endpoint (`/fdc/v1/food/{fdcId}`). Fetched during USDA import for both Foundation/SR Legacy Foods and Branded Products, and converted directly into Calibrated Custom Unit Measurements. If no portion data exists for a record, no extra Measurements are added. Not fetched for manually created Foods or Open Food Facts imports.
_Avoid_: serving suggestions, portion sizes

## Standard Unit
A mass unit (g, kg, oz, lb, mg) or volume unit (ml, l, cup, Tbs, tsp, fl-oz). Standard Units within the same category are mutually convertible using fixed conversion factors. When a Food has a Density, Standard Units from the opposite category are also available as Measurements.

## Custom Unit
A Measurement that is not a Standard Unit (e.g. slice, piece, loaf, can). Custom Units are food-specific and not mutually convertible. A Custom Unit becomes a Calibrated Custom Unit when a gram-weight per unit is defined for that Food.

## Calibrated Custom Unit
A Custom Unit on a Food that has a defined gram-weight (e.g. "1 slice = 30g"). Enables automatic calorie calculation when that unit is used in a Recipe ingredient or Pantry entry. Valid on any Food whose Serving Unit is mass, or on any Food whose Serving Unit is volume and which has a Density set (the gram-weight is bridged to the volume Serving Unit via Density).

## Uncalibrated Custom Unit
A Custom Unit on a Food that has no gram-weight defined. Calorie calculation returns zero when this unit is used in an ingredient. Flagged with a warning in the Food editor.

## Each Count Unit
A single, app-wide count unit — the literal value `each` — meaning "one item / one package". Serves as the universal default purchase unit for a Food that has no Custom Unit of its own, so shopping lines read as natural counts ("6 each", "1 each") instead of the nutrition anchor ("100 g"). It is **synthetic**: never stored in any Food's Measurements and never persisted on a Food, so it sits outside the usual rule that a unit must be one of the Food's Measurements — the shopping unit picker offers it *in addition to* a Food's Measurements. It is an Uncalibrated Custom Unit (no gram-weight), so stock recorded in `each` does not auto-convert during Meal Preparation Deduction and falls to the manual-entry path until a User assigns a calibrated unit. Invariant in the plural — always "each", never "eaches".
_Avoid_: item, count, bare unit, piece (a `piece` is a distinct, food-specific Custom Unit)

## Ingredient
A Food used in a Recipe, expressed as a quantity in a chosen Measurement. Calories are computed at load time from the Food's current nutrition data and the ingredient's quantity and unit. The `ingredients` table currently retains a `calories` column; that column will be removed once the `feat/serving-unit-refinement` migration lands, at which point calories will be fully derived and not stored. If the chosen unit is an Uncalibrated Custom Unit, the computed calories are zero.

## Nutrition Complete
A Recipe in which every Ingredient's calories can be fully calculated — i.e. no ingredient uses an Uncalibrated Custom Unit. Stored as a boolean on the Recipe and recomputed whenever the Recipe's ingredients are saved. Nutrition Complete status is used as a binary ranking signal: in public recipe discovery, Nutrition Complete recipes always rank above incomplete ones, regardless of the active sort order.

## Pantry Item
A unit of physical stock tracked in the user's pantry. Has an original size and a current size, each expressed as a quantity in a chosen Measurement. A Pantry Item has a `sourceType` discriminator that determines what it references: `'food'` (a generic Food, e.g. "Banana"), `'product'` (a branded Product, e.g. "Tyson Boneless Chicken Breast"), or `'recipe'` (a Prepared Meal). Exactly one of `foodId`, `productId`, or `recipeId` is set. For `'food'` and `'product'` items, units are constrained to the Measurements of the referenced Food or Product. For `'recipe'` items, the unit is always servings — see Prepared Meal.

## Prepared Meal
A Pantry Item with `sourceType: 'recipe'` representing a cooked recipe stored in the pantry. Tracked in servings (the unit is always "serving"). Created from the recipe detail page or the pantry page when a user logs that they have prepared a recipe. Creating a Prepared Meal triggers Meal Preparation Deduction — the recipe's ingredients are deducted from matching pantry items. The serving count defaults to the recipe's Serves value but may be overridden by the user; if Serves is null, the user must supply a count. Expiration date is optional and defaults to today + 4 days. The recipe name is snapshotted at creation time so the Prepared Meal remains visible even if the source recipe is later soft-deleted (orphan behaviour). If the source recipe is soft-deleted, the Prepared Meal is retained with its snapshotted name and no live link back to the recipe.
_Avoid_: cooked meal, meal prep, recipe pantry item

## Meal Preparation Deduction
An optional step when creating a Prepared Meal that reduces raw Pantry Item quantities to reflect the ingredients used. The user opts in via a checkbox on the Prepare Meal flow (default: on); if they opt out, no deductions occur and the Prepared Meal is created immediately. When opted in, each recipe ingredient is matched to pantry items by Food: a `'food'` item matches if its `foodId` equals the ingredient's Food; a `'product'` item matches if its Product's `parentFoodId` equals the ingredient's Food. Product Pantry Items with no `parentFoodId` are not automatically matched but may be linked inline during the deduction flow (see Deduction-Time Product Link). When multiple pantry items match the same ingredient, the user selects which to deduct from via a picker that surfaces the soonest-expiring item prominently. If a pantry item's unit cannot be automatically converted to the ingredient's unit (e.g. an Uncalibrated Custom Unit), the recipe's required quantity and the pantry item's unit are shown side-by-side and the user enters the deduction amount manually. If the pantry does not have enough stock to cover an ingredient, the user is warned and may proceed anyway; available stock is deducted and the shortfall is not tracked. If no pantry items match any ingredient, the user is warned and may proceed (creating the Prepared Meal with no deductions) or cancel.
_Avoid_: ingredient consumption, pantry deduction, stock reduction

## Deduction-Time Product Link
An inline action available within the Meal Preparation Deduction flow that permanently sets a Product's `parentFoodId`, linking it to a Food for all future deduction matching. Triggered per ingredient: each ingredient row exposes a collapsible product picker (see Ingredient Substitution) where unlinked products show a "Link & use" action. Selecting it immediately saves the link via the product API and auto-selects the now-confirmed product as the active deduction choice for that ingredient. No separate confirmation step is shown — the selection itself is the confirmation.
_Avoid_: product linking, food linking, manual match

## Ingredient Substitution
A one-time, per-preparation use of a Product Pantry Item as a stand-in for an ingredient, without establishing any permanent relationship between the Product and the ingredient's Food. Available within the Meal Preparation Deduction flow. Each ingredient row exposes a collapsible product picker showing two groups of Product Pantry Items: unlinked products (those with no `parentFoodId`) and products linked to a different Food. Unlinked products show both "Link & use" (see Deduction-Time Product Link) and "Use once" actions; products linked to a different Food show only "Use once". Selecting "Use once" adds the product as a visually distinct "Substituting with" row beneath the ingredient's normal match options, separate from the radio-button match list. The deduction amount is always entered manually — no auto-calculation is attempted, as the system makes no assumption about substitution ratios. A remove action clears the substitution and returns the ingredient to its prior state. The substitution is submitted as a standard `{ pantryItemId, amount }` deduction — no schema change is required.
_Avoid_: ad-hoc deduction, one-time match, manual substitution

## Review
A star rating (1–5) plus an optional text body left by a User on a public Recipe authored by another User. One Review per User per Recipe, enforced by a unique constraint. Can be edited in place (no revision history); `dateUpdated` tracks when it last changed. On Account Deletion the author is anonymised (userId set to null); on Account Deactivation the Review is preserved and visible. A User cannot review their own Recipe. Reviews can only be submitted on public Recipes, enforced at the API layer.
_Avoid_: comment, feedback, rating

## Review Report
A moderation signal submitted by a User against a Review whose content they consider inappropriate. Consists of a required reason selected from a fixed list ("Spam", "Offensive language", "Harassment", "Off-topic") and an optional free-text comment. One Report per User per Review, enforced by a unique constraint. Reports cascade-delete when the Review is deleted. The Recipe author cannot delete a Review directly; they may only submit a Review Report. Actioned by the Admin.
_Avoid_: flag, complaint

## Admin
The User account designated as the moderation authority, identified by the `ADMIN_USER_ID` environment variable. Reviews a queue of open Review Reports and takes one of two actions: dismiss the report (Review stays) or delete the Review (all reports on it cascade-delete).
_Avoid_: moderator, superuser

## Review Aggregate
The average star rating and total Review count for a Recipe, computed at query time from the `reviews` table. Displayed on the recipe detail page as e.g. "★ 4.2 · 18 reviews". No denormalised column on the Recipe.
_Avoid_: rating score, review summary

## Recipe Import
An umbrella for the recipe creation modes that produce a Recipe from an existing document rather than the Guided Recipe Form. Two sources exist: Markdown Recipe Import (the user pastes a structured markdown document) and URL Recipe Import (the user supplies a web URL to scrape). Both sources converge on a single shared Recipe Import Preview and Ingredient Resolution flow, differing only in how the source is parsed into a canonical parsed-recipe structure (title, metadata, ingredient strings, steps). All modes produce the same Recipe schema; Recipe Import is purely an authoring shortcut.
_Avoid_: paste import, bulk create, template import

## Markdown Recipe Import
A Recipe Import source in which the user writes a single structured markdown document — title, metadata (meal, serves, prep/cook time), ingredient list, and numbered steps — parsed **client-side** into the canonical parsed-recipe structure (see ADR-0017). Distinct from the Guided Recipe Form (the existing two-tab form).

## URL Recipe Import
A Recipe Import source in which the user supplies the URL of a recipe web page. The page is fetched and parsed **server-side** (the `recipe-scrapers` library extracts title, description, category, times, yields, ingredient strings, and instructions), then mapped into the same canonical parsed-recipe structure that Markdown Recipe Import produces, so it feeds the identical Recipe Import Preview. Individual ingredient strings use the scraper's own structured parse (quantity, unit, food name) rather than the markdown ingredient regex, as web recipe strings are messier than hand-written markdown. Ingredient section headers (e.g. "For the sauce") are dropped. The fetched URL is subject to the URL Fetch Guard. Because a server round-trip is unavoidable for scraping, ingredient-line parsing happens server-side here — this does not contradict ADR-0017, whose client-side-parsing rationale is specific to markdown. A URL-imported Recipe carries Recipe Attribution back to its source.
_Avoid_: recipe scraper, link import, web import

## Recipe Attribution
The link back to a Recipe's original source, captured only for URL Recipe Import. Stored as two nullable columns on the Recipe: `sourceUrl` (the scraper's canonical URL, falling back to the URL the user supplied) and `sourceName` (the scraper's site name, e.g. "NYT Cooking"). Rendered on the recipe detail page as a "Source:" link that opens the original in a new tab; when `sourceName` is absent the link text falls back to the URL's hostname. Recipes created via the Guided Recipe Form or Markdown Recipe Import have no attribution (both columns null). Attribution is display-only — it is not editable in the recipe editor.
_Avoid_: credit, citation, provenance (provenance is reserved for the Shopping List Item → Pantry Item link)

## URL Fetch Guard
The set of restrictions applied to a user-supplied URL before the server fetches it for URL Recipe Import, defending against server-side request forgery. Rejects non-http(s) schemes and hostnames resolving to loopback, private, or link-local ranges (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`), and bounds the fetch with a timeout and a maximum response size. See ADR-0023.
_Avoid_: SSRF filter, URL allowlist, link validation

## Recipe Import Preview
The intermediate state between a Recipe Import (Markdown or URL) and committing the Recipe to the database. Shows the parsed Recipe with each Ingredient either resolved (matched to a Food), substitutable (up to 3 candidate Foods presented for the user to choose from), or skippable (omitted from the Recipe with a warning that Nutrition Complete status may be affected). Metadata fields not present in the source (meal, serves, etc.) are shown as editable fallbacks. The user must confirm the Preview before the Recipe is created. Shared verbatim across both Recipe Import sources — it takes a parsed-recipe structure and owns everything from Ingredient Resolution through draft creation.
_Avoid_: parse result, import confirmation

## Ingredient Resolution
The process of matching a parsed ingredient string (from any Recipe Import source) to a Food in the database. First tries a case-insensitive substring match; if no match is found, returns up to 3 candidate Foods ranked by relevance for the user to choose from in the Recipe Import Preview. An ingredient that cannot be matched may be skipped, in which case it is omitted from the Recipe and the Recipe may not be Nutrition Complete.
_Avoid_: food lookup, ingredient matching

## Review Like
An upvote cast by a User on another User's Review. One Like per User per Review, enforced by a unique constraint. Toggled — clicking again removes the Like. A User cannot Like their own Review. Displayed as a count on the Review ("Liked by X chefs"). On Account Deletion the liker is anonymised (userId set to null) — the count is preserved since only the count is displayed, not who liked it.
_Avoid_: helpful vote, upvote, reaction

## Most Helpful Review
The Review on a Recipe with the highest Like count, pinned to the top of the Reviews tab with a "Most helpful" label. Ties broken by `dateAdded` (older Review wins). Only shown when at least one Like exists across the recipe's reviews.
_Avoid_: top review, featured review

## Shopping List
A user's list of items to buy on a grocery trip. Each User has at most one **active** Shopping List at a time; there is no naming or list-picker step — the active list is implicit, mirroring how the Pantry is a single per-user collection. When the User finishes shopping, the active list is archived (retained for price history and reuse) and a fresh active list can begin. Contains Shopping List Items.
_Avoid_: cart, grocery list (informal), basket

## Shopping List Item
A single line on a Shopping List: a thing to buy plus a desired quantity. The quantity is a single amount + unit, with the unit constrained to the referenced Food/Product's Measurements (freeform lines take a free-text unit or none) — the same shape as a Pantry Item's size. When a Food is added, the unit is **auto-derived and not chosen by the user** (an "Advanced" affordance exposes an override): it defaults to the Food's first Custom Unit (e.g. `fruit`, `bunch`, `can`) if it has one, falling back to the Each Count Unit otherwise — so every line reads as a natural purchase count ("6 each limes", "1 each flour") rather than the nutrition anchor ("100 g"). The Serving Unit is never used as a shopping default. The Pantry currently still defaults to the Serving Unit; aligning it is a tracked follow-up. Adding a Food that already has an open (`to_buy`) line for the **same Food and same unit** merges into that line by summing the amounts rather than creating a duplicate; a different unit, or a line that is already `bought`, produces a separate line. On completion it maps 1:1 to a single Pantry Item whose `originalSize` is this quantity + unit; there is no separate package-count concept. May optionally carry an **expiration date**, entered at Scan-to-Buy / check-off time; if present it transfers to the resulting Pantry Item's `expirationDate`, otherwise the Pantry Item's expiration is null. The Line Price is never copied to the Pantry Item — it remains on the (archived) Shopping List Item as price-history only. The resulting Pantry Item instead carries a nullable `shoppingListItemId` FK back to the Shopping List Item that produced it (provenance direction; `onDelete: set null`), so the pantry can surface purchase price and origin by reading *through* the link rather than duplicating them. The FK is null for Pantry Items created any other way (manual add, Prepared Meal). Like a Pantry Item it carries a `sourceType` discriminator, but with three variants: `'food'` (a generic Food, e.g. "Milk"), `'product'` (a specific branded Product, e.g. "Tyson Chicken Breast"), or `'freeform'` (an un-catalogued free-text line, e.g. "Trash bags", with no Food/Product link and no nutrition). Freeform items are the only variant that does not transfer to the Pantry when shopping completes. Has a `status`: `'to_buy'` (default), `'bought'` (checked off, manually or via Scan-to-Buy), or `'unavailable'` (the store did not have it — distinct from simply not yet bought). Status is reversible. Un-checking a Scan-to-Buy item does not revert an upgraded Product reference back to a Food. May optionally carry a **Line Price** — the total amount paid for the whole line (not per-unit), a single app-currency `numeric` entered at check-off and editable while the list is active. At entry the user may type either the total or a per-unit price; if they enter per-unit, the total is computed as per-unit × quantity. Only the total is persisted — per-unit cost is derived as Line Price ÷ quantity when needed. The app is single-currency and stores no currency code. Both the Line Price and the expiration capture are subject to the User's Price & Expiration Collection preference.
_Avoid_: list item, cart item, line item

## Price & Expiration Collection
A preference on a User controlling whether the Shopping List captures a Line Price and expiration date for its items. Defaults to on. When on, checking a Shopping List Item off prompts for its Line Price and expiration, which may also be entered manually while the list is active. When off, that prompt is suppressed and manual entry is hidden entirely — the User records neither until they turn it back on.
_Avoid_: pricing toggle, expiration setting

## Remove Item
A User action that permanently takes a Shopping List Item off the active Shopping List by intent, before Shopping Trip Completion. A hard delete: the row is removed outright (the `shopping_list_items` table has no `dateDeleted`), so it is not recoverable and leaves no price history — distinct from the soft-delete pattern used for content entities. Distinct from the `unavailable` status (which records that the store did not have the item) and from Trip Completion's batch drop of unbought lines (which discards remaining lines only at the end of a trip). Available only while the list is active.
_Avoid_: drop, discard, clear, cancel

## Scan-to-Buy
Checking off a Shopping List Item by scanning its barcode. When the scanned barcode resolves to a Product, the checked-off item is upgraded in place: a `'food'` line is promoted to `'product'`, attaching the actual scanned Product (and its barcode) so the Pantry later receives the specific branded item rather than the generic Food. Scanning a barcode not matching any item on the list adds a new, already-bought `'product'` item (impulse buy). If the scan resolves to no known Product, the existing Barcode Creation Modal creates one inline. Contrast with manual check-off, which marks an item bought without changing its Food/Product reference.
_Avoid_: scan-off, barcode check

## Pantry-Gap Fill
An "add what I'm missing" action that populates the active Shopping List from a Recipe. Each Recipe Ingredient is matched against current Pantry stock using the same Food-matching logic as Meal Preparation Deduction (a `'food'` pantry item matches on `foodId`; a `'product'` pantry item matches on its Product's `parentFoodId`). For any ingredient whose required quantity is not fully covered by matching stock, a `'food'` Shopping List Item referencing that ingredient's Food is added with a quantity equal to the shortfall (in the ingredient's unit). Ingredients already fully in stock are skipped. When the shortfall cannot be computed precisely (e.g. an Uncalibrated Custom Unit or an unconvertible unit), the ingredient's full required quantity is added instead. This is the only recipe-driven input method in v1; whole-recipe explosion (adding every ingredient regardless of stock) is deferred.
_Avoid_: missing-ingredients, restock, recipe explosion

## Shopping Trip Completion
The action of finishing a shopping trip. Archives the active Shopping List and creates Pantry Items from every `'bought'` Food or Product line (freeform lines never transfer). Any lines still unbought at completion — whether `'to_buy'` or `'unavailable'` — are handled together as a single group via one batch prompt: "You still have N items on your list — keep them for next time?" (default: keep). Keeping moves all remaining lines onto a fresh active Shopping List; dropping discards them with the archive. The two unbought statuses are not distinguished at this step.
_Avoid_: checkout, finish trip, list archival

## Status Legend
A key, shown above a list of cards on narrow viewports, that maps each colour-coded Status Dot to its meaning. Scoped per page: the Recipes, Foods, and Pantry lists each present only the statuses that appear on that page (e.g. Pantry shows Good / Expiring Soon / Expired / Frozen / Prepared; Recipes shows Unpublished; Foods shows In Use). Exists only on small screens, where text status badges collapse into Status Dots to save horizontal room; on wide screens the cards show the full-text badges and no legend is needed. Remains pinned below the header while the card list scrolls, so the key stays available as the user moves through items.
_Avoid_: key, status key, badge legend

## Status Dot
A small coloured circle standing in for a text status badge on a card when space is constrained (narrow viewports). Represents only categorical or binary statuses — Pantry expiration status, Frozen, Prepared, Unpublished, In Use — never a continuous value such as a calorie count or a free-form label such as a Meal type, which remain as text. Each dot carries an accessible label and reveals that label as a tooltip on tap or hover; the Status Legend provides the shared key. The dots on cards softly pulse to draw the eye (suppressed when the user prefers reduced motion); the reference dots in the legend stay still.
_Avoid_: status pip, indicator, badge dot
