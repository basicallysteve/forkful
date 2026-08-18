# ADR-0024: Narrow Unit Vocabulary for Recipe Import Ingredient Parsing

**Status:** Accepted

## Context

`parseIngredientLine` (`src/utils/recipeMarkdownParser.ts`) turns a single ingredient string into `{ quantity, unit, foodName }`. It is the primary parser for Markdown Recipe Import and the fallback parser for URL Recipe Import (used when `recipe-scrapers` cannot structure a line).

The original grammar was `<number> <one-word> <rest>` and treated the word after the quantity as the unit **unconditionally**. That mis-parses the two most common real-world shapes:

- **Adjective-as-unit:** `"2 large eggs"` → unit `"large"`, food `"eggs"`. The adjective becomes the unit.
- **No unit at all:** `"3 bananas"` → unit `"bananas"`, food missing.

A parsed unit is then committed to the Ingredient, so a wrong guess produces a nonsense unit — an Uncalibrated Custom Unit that yields zero calories and drops the Recipe out of Nutrition Complete.

The parser must decide, for the token after the quantity: **is this a unit, or part of the food name?**

## Decision

Treat the leading token as a unit **only if it normalises to a known unit** — matched against a narrow vocabulary of the app's Standard Units and existing Custom Units, plus their common aliases/abbreviations and (via `pluralize`) plural forms. Anything not in the vocabulary is **folded back into the food name**, with `unit = null`.

The vocabulary is deliberately narrow: mass (g, kg, mg, oz, lb), volume (ml, l, cup, Tbs, tsp, fl-oz), and the existing `CUSTOM_UNITS` (slice, piece, serving, portion, loaf, can, bottle, package). Unusual recipe count-units (clove, sprig, stick, head, bunch, …) are **not** included and therefore fold into the food name.

## Rationale

- **Word-level Ingredient Resolution recovers the folded word.** `resolve-ingredients` matches on individual food-name words (>2 chars, minus stop-words), so `"large eggs"` still resolves to *Eggs* and `"clove garlic"` still resolves to *Garlic*. Folding a stray token costs nothing at match time.
- **A wider list buys no correct calories.** An unrecognised count-unit like `clove` has no calorie path unless the matched Food carries a Calibrated Custom Unit for it — which the importer cannot invent. Recognising `clove` as a unit would only relabel a zero-calorie ingredient, not make it calculable.
- **Zero maintenance.** A narrow, closed vocabulary tracks the units the app already models. A broad hand-maintained list of every count-noun cooks use would drift and still be incomplete.
- **The editable Preview is the real backstop.** The Recipe Import Preview exposes each resolved Ingredient's unit as an editable control bound to the matched Food's Measurements, so any parser miss (count-unit or otherwise) is correctable before the Recipe is created. Parser precision is a convenience, not the safety net.

## Alternatives Considered

- **Wide vocabulary (narrow + common count-units).** Keeps `clove`/`sprig`/`bunch` as recognised (Uncalibrated Custom) units, so the food name stays clean and the unit label matches intent. Rejected as the default: it produces zero-calorie ingredients just the same, adds an open-ended list to maintain, and risks capturing a genuine food word as a unit. The editable Preview covers the same ground without a curated list.
- **Keep treating the first token as a unit unconditionally.** Simplest, but this is the bug — adjectives and unit-less counts are pervasive in real recipes.

## Consequences

- `"2 large eggs"` → `{ quantity: 2, unit: null, foodName: "large eggs" }`; `"2 cups flour"` → `{ quantity: 2, unit: "cup", foodName: "flour" }`.
- Count-unit lines (`"2 cloves garlic"`) parse with `unit: null` and fall back to the Food's serving unit at commit time — a wrong quantity semantics that the user is expected to correct in the editable Preview.
- The quantity grammar is extended alongside this change to accept fractions, mixed numbers, and unicode vulgar fractions (`1/2`, `1 1/2`, `½`, `1½`); ranges (`1-2`) and quantity-less lines (`"salt to taste"`) remain out of scope.
- The rule changes parse semantics users build expectations around, so it is documented here rather than left implicit in a regex.
