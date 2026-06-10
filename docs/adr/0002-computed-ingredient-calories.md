# Ingredient calories are computed at load time, not stored

Ingredient calories are calculated on-the-fly from the food's current nutrition data (calories, serving size, serving unit) and the ingredient's quantity and unit, rather than being stored as a column on the ingredients table. This means if a food's nutritional data is corrected, every recipe that uses it immediately reflects the updated values — no backfill needed. The trade-off is a slightly more expensive read path (requires joining food data), but that join was already necessary to render ingredient names and units.

## Considered Options

- **Stored calories (rejected):** Simpler reads. Rejected because stored values drift when food data changes and require explicit re-propagation logic on food edits — a hidden correctness burden.
- **Computed at load time (chosen):** Always consistent with food data. Custom units require `gramsPerUnit` calibration data on the food; without it, calories return zero and the recipe is flagged as Nutrition Incomplete.
