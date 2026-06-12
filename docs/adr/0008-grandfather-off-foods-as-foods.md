# ADR 0008: Grandfather existing Open Food Facts imports as Foods

## Status
Accepted

## Context
The domain model was refactored to split the single `foods` table concept into two tiers:
- **Food** — a generic, canonical nutritional item (e.g. "Chicken Breast"), used in Recipe Ingredients.
- **Product** — a branded, purchasable item with a barcode (e.g. "Tyson Boneless Chicken Breast"), used in Pantry Items.

Under this model, items imported from Open Food Facts are Products. However, at the time of this decision, a number of rows in the `foods` table had `source = 'open_food_facts'` and barcodes — and some of those rows were already referenced by Recipe Ingredients.

## Decision
Existing `source = 'open_food_facts'` rows in the `foods` table are grandfathered in place. They remain in the `foods` table and continue to function as Foods for the purpose of Recipe Ingredients. No migration to the `products` table is performed on existing data.

Going forward, new imports from Open Food Facts and USDA Branded Foods create rows in the `products` table, not the `foods` table.

## Consequences
- Zero data-migration risk. No existing recipes are broken.
- The `foods` table will contain a small number of branded, barcoded rows indefinitely. These can be identified by `source = 'open_food_facts'` and a non-null `barcode`.
- The inconsistency fades naturally as users build out their Food library via USDA Foundation/SR Legacy imports.
- Attempting to auto-match existing OFF rows to generic Foods (e.g. "Tyson Chicken Breast" → "Chicken Breast") was ruled out due to unreliable fuzzy name matching and the risk of corrupting ingredient references.
