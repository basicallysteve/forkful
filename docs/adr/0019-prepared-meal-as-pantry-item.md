# ADR-0019: Prepared Meals as Pantry Items with sourceType 'recipe'

**Status:** Accepted

## Context

Users can cook a recipe and want to track the resulting meal in their pantry (e.g., "4 servings of Lemon Chicken in the fridge"). This requires a new entity — a Prepared Meal — that sits in the pantry alongside raw food and product stock. Three structural decisions had genuine alternatives and are surprising without this context.

## Decision 1: Prepared Meals are Pantry Items (sourceType: 'recipe'), not a separate table

A Prepared Meal is stored in the existing `pantry_items` table with `sourceType = 'recipe'` and a new nullable `recipeId` column. The recipe name is snapshotted into a `recipeNameSnapshot` column at creation time. Size is tracked in servings via the existing `originalSizeAmount` / `currentSizeAmount` columns.

**Rationale:** The pantry's core job — tracking stock with a current size and an expiration date — applies equally to raw ingredients and cooked meals. A separate table would duplicate that logic and fragment the pantry view. The `sourceType` discriminator pattern was already designed to accommodate this case.

**Alternative considered:** A dedicated `prepared_meals` table with its own schema. Rejected because it would require a parallel pantry query, a separate UI section, and duplicate expiration/status logic — more complexity for no user-visible benefit.

## Decision 2: Meal Preparation Deduction is opt-in at flow start

When a user creates a Prepared Meal, a checkbox (default: on) controls whether the recipe's ingredients are deducted from matching pantry items. If the user opts out, the Prepared Meal is created immediately with no deductions.

**Rationale:** Users frequently cook from groceries they haven't logged in the pantry. Forcing them through a deduction screen full of "no stock found" warnings for every ingredient is friction with no gain. Making deduction opt-out (rather than opt-in) keeps it discoverable and on by default for users who do track ingredients, while letting others skip cleanly.

**Alternative considered:** Always showing the deduction step and requiring explicit dismissal. Rejected because an empty-pantry user would face a mandatory confirmation of zero deductions on every meal prep.

## Decision 3: Prepared Meals orphan gracefully when the source recipe is soft-deleted

If the source recipe is soft-deleted after a Prepared Meal is created, the Prepared Meal remains visible in the pantry using its snapshotted recipe name. The `recipeId` foreign key is set to `SET NULL` on delete. The pantry item is not hidden.

**Rationale:** The physical meal in the user's fridge exists independently of the recipe record. Hiding or cascading the pantry item would silently remove stock the user knows they have. The snapshotted name ensures the item remains legible even with no live recipe link.

**Alternative considered:** Cascade soft-delete — hiding the Prepared Meal when its recipe is deleted, matching the behaviour of Food and Product pantry items when their source is deleted. Rejected because a user deleting a recipe (e.g., cleaning up drafts) should not also wipe their fridge inventory.

## Consequences

- `pantry_items` requires a `recipe_id` column (nullable, `SET NULL` on recipe delete) and a `recipe_name_snapshot` column (varchar).
- The `sourceType` discriminator gains a third value: `'recipe'`. Pantry queries must handle all three branches.
- Meal Preparation Deduction requires unit conversion between ingredient units and pantry item units. When conversion is not possible (Uncalibrated Custom Unit or missing Density), the required quantity and pantry unit are shown side-by-side and the user enters the deduction amount manually.
- The existing `currentSizeAmount` pattern handles consuming servings over time — no new mechanics needed.
