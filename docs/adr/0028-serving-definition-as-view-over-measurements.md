# Serving Definition is a view over the existing anchor, Density and Measurements, not a servings table

LoseIt-style serving definitions (a weight, a volume and count amounts, all equal in calories) are edited through a form, but stored in the fields Foods and Products already have: Serving Size and Serving Unit (the anchor), Density, and `measurements` entries `{ unit, gramsPerUnit?, mlPerUnit? }`. When a weight is given, the food is re-anchored to it (so "2 slices = 56 g" is stored as 56 g with slice = 28 g), so every serving reaches grams and equal calories hold by construction, with nutrition stored once. A count unit with no weight available can be calibrated by volume instead (`mlPerUnit`). Each unit keeps one calibration, and grams are tried first. Editing a serving keeps the nutrition fixed and rewrites the equivalents: Ingredients and Pantry Items, which are derived, follow; Food Log Entries, which are frozen (ADR-0025), do not. All conversion goes through one framework-free `convertFoodAmount`, so the iOS app can reuse it.

## Considered Options

- **`food_servings` table:** rejected. It duplicates the Measurements and anchor as a second source of truth, and needs a migration plus join changes in recipes, pantry and logging.
- **JSON column of servings with their own calories:** rejected. "Same calories" would become an invariant to enforce rather than a property of the data.
- **View over the existing fields with re-anchoring (chosen).**

## Consequences

- Serving Definitions are global, like every Food edit; there is no per-User ownership. Food write endpoints must require sign-in (#181).
- `calculateCalories` and `servingScaleFactor` delegate to `convertFoodAmount`, and pantry deduction auto-converts calibrated count units.
- Adding `mlPerUnit` needs no migration, because the field is optional in the jsonb column. This supersedes the "grams only" calibration in ADR-0003.
- A pure shared validator runs on both the client and the API: amounts above 0, weight up to 5 kg, volume up to 5 l, unit names trimmed, lowercase, at most 50 characters, no duplicates. Stored per-unit weights and volumes round to 2 decimals and Density to 4; calculations run at full precision.
