# Food measurements stored as objects with optional gram-weight, not plain strings

> **Implementation status:** The DB schema and `Food` type still use `string[]` for `measurements`. The migration to `{ unit, gramsPerUnit? }[]` (including the `parseMeasurements` backward-compatibility shim) is tracked in the `feat/serving-unit-refinement` branch and will land in a follow-up merge.

`food.measurements` is stored as `{ unit: string, gramsPerUnit?: number }[]` rather than `string[]`. The extra `gramsPerUnit` field is what enables custom units (slice, piece, can, etc.) to participate in calorie calculations: when a gram-weight is defined, the system can convert the custom unit to grams and apply the food's per-gram calorie rate. Without this field, custom units would require a separate lookup table or could never be calibrated at all.

## Considered Options

- **Separate calibration map (rejected):** Storing `{ [unit: string]: number }` alongside a `string[]` was considered but creates two sources of truth for the measurement list and makes the data harder to pass around as a unit.
- **Rich object array (chosen):** A single array where each entry carries both the unit name and its optional calibration weight. A `gramsPerUnit` of `undefined` means the unit is uncalibrated; zero is not used (zero would imply weightless). The `unit` field doubles as the display label.

## Consequences

Existing `measurements` data in the database (plain strings from before this change) must be migrated. The migration script wraps each string `"unit"` as `{ unit: "unit" }` with no `gramsPerUnit`, preserving behaviour for previously uncalibrated units.
