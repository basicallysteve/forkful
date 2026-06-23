# LLM used to normalize USDA food names at import time

Raw USDA Foundation/SR Legacy descriptions follow a machine-generated `NOUN, QUALIFIER, QUALIFIER` convention (e.g. `"CHICKEN, BREAST, BONELESS, SKINLESS, RAW"`) that is not suitable for display to users. These names need to be normalized into a human-readable form before being stored as Food names.

## Considered Options

- **Rule-based heuristic (rejected):** Title-case the raw description and move comma-separated tokens after the first into a parenthetical suffix. Fast and zero-cost but brittle — the correct split point varies (e.g. `"MILK, WHOLE"` needs a 1-token noun, `"BEEF, GROUND, 80% LEAN"` needs a reversed 2-token noun), and the rules would need ongoing maintenance as new USDA entries are encountered.
- **LLM call at import time (chosen):** Pass the raw USDA description to Claude and receive a normalized name back. Accurate across all name patterns without special-casing. Adds one API call per import, which is acceptable since USDA import is a deliberate, infrequent user action. If the LLM call fails, fall back to the raw description and log the failure — import is never blocked.
- **LLM-only in a one-time migration (rejected as insufficient):** Normalizing only existing rows would leave new imports with raw USDA names until someone ran the script again. The migration and the import-time call must both exist.

## Decision

Use a Claude LLM call during `importUSDAFood` to normalize the food name before it is written to the DB. A one-time migration script applies the same normalization to all existing `source = 'usda'` rows in the `foods` table, regenerating each row's slug from the new name.

Scope is limited to `source = 'usda'` (Foundation/SR Legacy Foods). USDA Branded Products are excluded — their names are author-supplied by brand owners and do not follow the all-caps comma-reversed convention.

## Consequences

- `importUSDAFood` gains a Claude API call. The raw USDA description is no longer stored after a successful import; `externalId` preserves the link to the source record.
- Slug is regenerated from the normalized name. Food slugs are not referenced by other tables (ingredients and pantry items use numeric `foodId`), so this is safe.
- LLM failure at import time falls back to the raw USDA description and logs the failure. Import is never blocked.
- The one-time migration must be idempotent — re-running it on already-normalized rows should produce no change (the LLM call for a well-formed name like `"Chicken Breast (boneless, skinless, raw)"` should return the same string).
- Foods that users may have manually renamed after import will have their names overwritten by the migration. This risk is accepted: the overlap between "imported from USDA" and "later manually renamed" is very small, and the consequence (a cosmetic rename the user can correct) is low.
