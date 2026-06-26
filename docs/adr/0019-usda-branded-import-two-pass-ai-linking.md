# ADR 0019: Two-pass approach for USDA Branded Product import with AI-assisted parent Food linking

## Status
Accepted

## Context
Products can optionally carry a `parentFoodId` linking them to a generic Food. This link enables recipe nutrition tracking when a user adds a branded Product to their pantry — the system uses the parent Food's per-100g nutrition data. Without the link, a Product in the pantry contributes nothing to recipe suggestions.

Importing USDA Branded Foods from the FDC Full Download CSV creates hundreds of thousands of Product rows. Each row needs a `parentFoodId` resolved from the existing `foods` table (Foundation/SR Legacy Foods). The match is non-trivial: a branded name like `"TYSON, Boneless Skinless Chicken Breast, 3 lb"` must map to a canonical Food like `"Chicken Breast (boneless, skinless, raw)"`.

## Considered Options

**Inline linking during import:** Each Product row is linked to its parent Food as it is inserted — one LLM call per product during the CSV import pass.

- Fast to implement, single script.
- Blocks the import on LLM rate limits and API cost at scale (potentially hundreds of thousands of calls in a single run).
- A transient LLM failure or budget exhaustion would halt the import mid-stream, leaving a partially-imported dataset.

**Two-pass: import then link (chosen):** A fast, deterministic import script writes Products with `parentFoodId = null`. A separate linker script runs afterward and resolves links incrementally.

- The import is fast, idempotent, and never blocked by LLM availability.
- The linker is independently re-runnable, can be rate-limited, and skips already-linked rows (`parentFoodId IS NOT NULL`).
- Dry-run mode on the linker allows review of AI decisions before committing at scale.
- Matches the precedent set by `normalize-usda-food-names.ts` (import fast, enrich separately).

## Decision

Use two scripts:

1. **`scripts/seed-usda-branded.ts`** — streams the FDC Branded CSV files, filters to cooking-relevant `branded_food_category` values, and upserts rows into `products` with `parentFoodId = null`. Re-runnable; upserts on `externalId`.

2. **`scripts/link-product-foods.ts`** — processes all Products where `parentFoodId IS NULL`. For each, it strips the brand owner and weight/unit suffixes from the product name, runs an `ilike` search against `foods` to find up to 5 candidates, then passes the branded name and candidates to Claude Haiku to pick the best match or return `"none"`. Writes `parentFoodId` on a match; leaves null on `"none"` or zero candidates. Supports `--dry-run` to print decisions without writing. Re-runnable and incremental.

The linker applies to all unlinked Products regardless of source (`usda_branded`, `open_food_facts`, `manual`), so it serves as a general-purpose parent-linking tool, not just a post-import step.

## Consequences

- The `products` table will have a period where newly imported rows have `parentFoodId = null`. This is acceptable — the link is optional by design and pantry tracking works without it.
- Running the linker on Open Food Facts products may yield fewer matches (noisier names) but will not produce incorrect links — the LLM returns `"none"` when confidence is low.
- LLM costs are bounded by the number of unlinked Products that have at least one candidate Food in the DB (zero-candidate rows are fast-pathed without an LLM call).
- The dry-run flag makes it safe to preview AI decisions before a production linking run.
