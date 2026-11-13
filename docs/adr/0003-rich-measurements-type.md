# Food measurements stored as objects with optional gram-weight, not plain strings

> **Implementation status:** Implemented. `foods.measurements` and `products.measurements` are `jsonb` columns typed `Measurement[]`, and `parseMeasurements` in `src/lib/pantry.ts` still wraps legacy plain strings. ADR-0028 adds an optional `mlPerUnit` calibration alongside `gramsPerUnit`.

`food.measurements` is stored as `{ unit: string, gramsPerUnit?: number }[]` rather than `string[]`. The extra `gramsPerUnit` field is what enables custom units (slice, piece, can, etc.) to participate in calorie calculations: when a gram-weight is defined, the system can convert the custom unit to grams and apply the food's per-gram calorie rate. Without this field, custom units would require a separate lookup table or could never be calibrated at all.

## Considered Options

- **Separate calibration map (rejected):** Storing `{ [unit: string]: number }` alongside a `string[]` was considered but creates two sources of truth for the measurement list and makes the data harder to pass around as a unit.
- **Rich object array (chosen):** A single array where each entry carries both the unit name and its optional calibration weight. A `gramsPerUnit` of `undefined` means the unit is uncalibrated; zero is not used (zero would imply weightless). The `unit` field doubles as the display label.

## Consequences

Existing `measurements` data in the database (plain strings from before this change) must be migrated. The migration script wraps each string `"unit"` as `{ unit: "unit" }` with no `gramsPerUnit`, preserving behaviour for previously uncalibrated units.

## Amendment (2026-11, #156)
A Measurement now carries at most one calibration: `gramsPerUnit`, or `mlPerUnit` for a food with no weight (ADR-0028). Grams are tried first. Both are optional, so no data migration is needed.
