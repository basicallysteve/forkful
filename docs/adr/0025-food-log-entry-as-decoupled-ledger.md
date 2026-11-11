# ADR-0025: Food Log Entry is a decoupled nutrition ledger

**Status:** Accepted

## Context

Food logging lets a User record what they consumed each day and track calorie/macro intake, optionally drawing the item out of their pantry. The obvious implementation — a log entry that is just "a pantry deduction with a date" — was rejected in favour of an independent nutrition ledger. Three of the structural choices behind that are surprising when read against the rest of the codebase (which computes ingredient calories live, keeps stock deductions balanced with a live UI, and stores every timestamp in UTC), so they are recorded here. See the Food Log Entry, Daily Log, and Log Date terms in `CONTEXT.md`.

## Decision 1: The log is an independent ledger with an *optional* pantry link, not a pantry operation

A Food Log Entry references a Food, Product, or Prepared Meal for its nutrition and carries a **nullable** link to a Pantry Item. When the link is present, creating the entry also deducts stock; when absent, the entry records nutrition only.

**Rationale:** A calorie tracker that can only record food that passed through the user's pantry cannot log a restaurant meal, a coworker's cake, or a coffee — half the point of tracking intake. Making the pantry link optional subsumes the pantry-sourced case (link present) without excluding the eaten-out case (link absent). It mirrors the existing optional `shoppingListItemId` provenance link on Pantry Item — provenance without hard coupling.

**Alternative considered:** Every log entry *must* reference a Pantry Item (logging = "deduct and record"). Rejected because it makes anything eaten outside the home untrackable, gutting the feature's stated purpose.

## Decision 2: Macros are snapshotted (frozen) at log time, not computed live

The five core macros (calories, protein, carbs, fat, fiber) are computed once — reusing `calculateCalories` / `convertUnit` — and frozen onto the entry. The referent FK and resolved amount + unit are retained for provenance and display, but the macro numbers are facts of record. An explicit *edit* of the entry re-computes and re-freezes; ambient changes to the referent Food do not.

**Rationale:** A log is a historical record of what a User actually ate on a date. If a Food's calories are corrected next month, an August 19th intake total must not silently change. This deliberately diverges from Ingredient calories, which are computed live because a recipe should always reflect a Food's *current* nutrition — a recipe is a living definition; a log entry is a past event. Snapshotting also keeps daily totals cheap to sum and lets an entry survive soft-deletion of its referent (the same orphan instinct as a Prepared Meal's `recipeNameSnapshot`).

**Alternative considered:** Compute macros live from the referent at read time, matching Ingredients. Rejected because it rewrites history on every Food edit and breaks entirely when the referent is deleted.

## Decision 3: Pantry deduction is fire-and-forget — no stock restoration, ever

When a pantry-linked entry is created, stock is deducted once (`GREATEST(0, current - amount)`). Editing or deleting the entry changes the ledger only; it never restores or re-trues pantry stock. A mis-logged deduction is corrected by editing the Pantry Item directly.

**Rationale:** This matches the app's existing one-directional stock model — Meal Preparation Deduction subtracts and never reverses, and no stock-restoring path exists anywhere. Making the log reversible would introduce the *first* such path, with all its edge cases: the item may have since been consumed to zero, frozen, or deleted, and an edit would need to re-run unit conversion to compute a delta. Keeping the ledger and the pantry as two records written together (not a transaction that must stay balanced forever) is simpler and honest about what each represents.

**Alternative considered:** Fully reversible deductions (delete restores stock, edit adjusts the delta). Rejected as disproportionate complexity for a rare mistake, and inconsistent with Meal Preparation Deduction.

## Decision 4: The day bucket is a client-derived local `logDate`; UTC is never used for bucketing

The instant is not stored; only a `logDate` (`date`) is, derived on the client from the browser's local day (`Intl` / `toLocaleDateString`) and sent with each write. There is no `users.timezone` column and no geolocation.

**Rationale:** "What day did I eat this" is a user-local question. Bucketing by UTC date misfiles every evening meal for users west of UTC (7pm Tuesday local is 03:00 Wednesday UTC). The browser is the only party that already knows the user's local day, for free and with no permission prompt — geolocation would add a prompt, a lat/long→IANA mapping, and offline failure for no gain. Storing only the date sidesteps the "11:58pm — today or tomorrow?" fuzz because the client has already resolved it. The Daily Log itself is a derived view (no `daily_logs` table): a day has no lifecycle or status, so nothing to store.

**Alternative considered:** Add a `users.timezone` column and bucket server-side; or store a UTC `consumedAt` and bucket by its UTC date. Rejected — the first adds a column and migration to recover information the client already has; the second reintroduces the misfiled-evening-meal bug.

## Consequences

- A new `food_log_entries` table: referent discriminator `sourceType ('food' | 'product' | 'prepared_meal')`, nullable referent FKs, nullable `pantryItemId` link, frozen macro columns, resolved amount + unit, nullable `mealSlot` (string snapshot), `logDate`, and `dateDeleted` (soft-delete, per the content-entity convention).
- Two mechanisms now change pantry stock — Meal Preparation Deduction and Food Log Entry. No double-counting: preparing a recipe deducts raw ingredients and yields a Prepared Meal (servings); logging deducts the thing eaten (a Food/Product's stock, or a Prepared Meal's servings), never the raw ingredients again.
- Logging in an Uncalibrated Custom Unit would compute zero macros; the flow offers inline calibration of the referent Food/Product, and on decline logs zero with a nutrition-incomplete flag rather than blocking (logging is never a dead end).
- Correcting a mistake is an entry edit, not a Food edit; editing amount/unit re-freezes from current nutrition, and is disabled when the referent has been soft-deleted (the entry survives on its snapshot).
