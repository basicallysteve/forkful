# USDA Portion Data used to auto-populate Measurements and Density at import time

When importing a Food or Product from USDA (Foundation/SR Legacy or Branded), the system fetches the full food detail record (`/fdc/v1/food/{fdcId}`) to retrieve `foodPortions`. Custom-unit portions (e.g. "1 slice = 28g") are converted into Calibrated Custom Unit Measurements. Volume-unit portions (e.g. "1 cup = 128g") are additionally used to derive Density (g/ml). Manually created Foods and Open Food Facts imports receive no auto-populated Measurements or Density.

## Considered Options

- **Hardcoded keyword table (rejected):** A static map from food name patterns to suggested units (e.g. "bread" → slice, loaf). Simple but requires ongoing maintenance and produces guesses rather than measured data.
- **LLM-generated suggestions (rejected):** Call Claude with the food name to suggest units and gram weights. Flexible but adds latency, cost, and non-determinism to the import flow.
- **LLM on-demand in editor (rejected for USDA foods):** A "Suggest measurements" button for manual foods. Good for manual entry but wasteful for USDA foods that already have authoritative portion data.
- **USDA `foodPortions` at import time (chosen):** Fetch the full food detail endpoint during import and map portions directly to Calibrated Custom Units. Data is authoritative (real measured weights), no inference needed.

## Decision

Use USDA Portion Data for USDA imports; no auto-population for manual or Open Food Facts foods.

The USDA `foodPortions` field provides exactly what we need — unit names and gram weights — without guessing. The cost is one additional API call per import, which is acceptable because import is a deliberate, infrequent user action. The same single fetch that populates Measurements also derives Density when a volume portion is present — no extra call needed. Manual and Open Food Facts foods have no equivalent authoritative source, so they receive no auto-populated Measurements or Density; the Food editor remains the right place for authors to add them by hand.

## Consequences

`mapUSDAFoodToFood` and `mapUSDABrandedToProduct` must become async and accept a `foodPortions` payload. The import flow must first fetch `/fdc/v1/food/{fdcId}`, extract `foodPortions`, and pass them through. Custom-unit portions map to `Measurement[]`; the first volume-unit portion (if any) is used to derive density as `gramWeight / volumeInMl`. If multiple volume portions exist, the first is used. If the detail fetch fails or returns no portions, import proceeds normally with no extra Measurements and null density — it is not a blocking error. Users may override auto-derived density in the Food/Product editor.
