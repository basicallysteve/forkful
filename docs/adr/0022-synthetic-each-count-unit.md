# ADR-0022: A synthetic `each` count unit as the default shopping purchase unit

**Status:** Accepted

## Context

When adding a Food to a Shopping List, the line needs a unit. The first cut of the feature exposed a Unit dropdown and defaulted it via `preferredShoppingUnit` — the Food's first Custom Unit if it had one, otherwise the Food's **Serving Unit** (the nutrition anchor, usually grams).

This produced unnatural lines for any Food lacking a Custom Unit: **"Limes (raw) — 6 g"**, **"1 g"**. On a shopping list you are counting things you toss in the cart ("2 milk", "1 flour", "6 limes"), not weighing them — grams is a pantry-tracking concern, not a purchase quantity. We also decided to **hide** the unit picker entirely on the add form (behind an "Advanced" override), which raises the stakes: whatever the hidden default is, most users will never correct it, so it must read naturally on its own.

The Serving Unit fallback fails that bar. We needed a default that reads as a count for *any* Food.

## Decision 1: introduce `each` as the universal count-unit fallback

The shopping default order becomes **Food's first Custom Unit → `each`**. The Serving Unit is never used as a shopping default. So peaches (which have a `fruit` Custom Unit) default to "6 fruit", while limes and flour (grams-only) default to "6 each" / "1 each".

**Rationale:** `each` means "one item / one package", which is the shopping mental model for every Food regardless of how its nutrition is anchored. It reads naturally after any amount and needs no per-Food metadata to decide when to apply.

**Alternative considered — keep grams for "bulk" foods, use `each` only for "countable" ones.** Rejected because nothing in the data distinguishes countable (limes) from bulk (flour); both are just grams-anchored Foods. Making the distinction would require a new "countable" flag on every Food — real scope for a cosmetic gain, and still wrong whenever the flag is unset.

## Decision 2: `each` is synthetic — never persisted on a Food

`each` is a single app-level unit registered in the unit utilities. It is **not** written into any Food's `measurements` jsonb and **not** persisted on a Food row. The shopping unit picker offers it *in addition to* a Food's Measurements, softening the prior invariant "a line's unit is one of the Food's Measurements" to "…or `each`". Shopping List Items and Pantry Items store the literal string `"each"` like any other unit.

**Rationale:** `each` is universal — "one item" means the same thing for every Food — so persisting it per-row is pure duplication that would bloat every Food's Measurement list and require injecting it on every future import forever. An app-level constant keeps Food data clean and needs no migration.

**Alternative considered — add an `each` Measurement to every Food via migration.** Rejected: it keeps the invariant literally true at the cost of duplicating a universal concept across every row, in perpetuity.

## Decision 3: `each` is uncalibrated, and invariant in the plural

`each` has no gram-weight, making it an Uncalibrated Custom Unit. Stock recorded in `each` therefore does not auto-convert during **Meal Preparation Deduction** — it drops into the existing manual-entry path — until a User assigns a calibrated unit (Pantry Item units are editable after creation). `each` also never pluralises: it renders as "1 each" / "6 each", never "eaches".

**Rationale:** Calibrating a synthetic "one item" to a mass would be a fiction (one *what*?). Leaving it uncalibrated is honest, and the deduction flow already degrades gracefully to manual entry for uncalibrated units, so nothing breaks — it just isn't automatic. Because English "each" is invariant, the unit-pluralisation helper must treat it as an uncountable exception (a naïve `pluralize("each")` yields the wrong "eaches").

## Consequences

- The unit utilities gain `each` as a recognised custom, uncalibrated unit, and the shopping unit-option builder appends it to every Food's Measurements.
- The "a line's unit is one of the Food's Measurements" invariant is softened to allow `each`; code that assumed the strict form must tolerate it.
- The custom-unit pluralisation helper must register `each` as uncountable.
- Shopping calories are unaffected — the Shopping List computes none — and Pantry calorie display is unaffected because it shows a Food's base nutrition, not a value derived from the item's unit. The only unit-conversion site, Meal Preparation Deduction, handles `each` via its existing manual path.
- Foods that *should* read as a specific count (e.g. Limes with a `lime`/`fruit` Custom Unit) still get the nicer, calibratable Custom Unit when that data exists; `each` is the floor, not a ceiling. Curating Custom Units on common Foods remains a worthwhile data follow-up.
- This revises already-shipped behaviour (the visible Unit dropdown on the add form). Implementation follow-up is tracked separately.
