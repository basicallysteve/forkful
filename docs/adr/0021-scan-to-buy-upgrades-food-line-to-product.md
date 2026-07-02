# ADR-0021: Scan-to-Buy upgrades a planned Food line to the bought Product

**Status:** Accepted

## Context

The Shopping List feature lets a User plan a grocery trip and, while shopping, check items off — either manually or by scanning a barcode (Scan-to-Buy). On completion, every bought line becomes a Pantry Item.

There is an inherent mismatch between how users *plan* and what they *buy*. Planning is generic: a user adds "Milk" — a canonical **Food**. But the thing they physically put in the cart and scan is a specific branded **Product** (e.g. "Lucerne 2% Milk", with a barcode). A Shopping List Item therefore starts life referencing a Food but, at the moment of scanning, learns the concrete Product it corresponds to.

How the item reconciles these two references — and what consequently lands in the pantry — is surprising without this context and is genuinely hard to reverse, because it dictates the Shopping List Item lifecycle and the Completion → Pantry transfer semantics.

## Decision: scanning a planned `food` line upgrades it in place to a `product` line

A Shopping List Item carries a `sourceType` of `'food'`, `'product'`, or `'freeform'`. When a User checks off a `'food'` line by scanning a barcode that resolves to a Product, the item is **mutated in place**: its `sourceType` is promoted from `'food'` to `'product'`, the scanned Product (and its barcode) is attached, and the item is marked `'bought'`. At Completion the item transfers 1:1 to a Pantry Item referencing the specific **Product**, not the generic Food.

Supporting rules:
- **Off-list scan** — a scanned barcode matching no line on the list adds a new, already-`'bought'` `'product'` item (impulse buy).
- **Unknown barcode** — a scan resolving to no known Product reuses the existing **Barcode Creation Modal** to create the Product inline, then proceeds as an upgrade.
- **Manual check-off** — ticking an item by hand marks it `'bought'` without changing its Food/Product reference; only scanning upgrades.
- **Un-check is non-destructive** — reverting a `'bought'` item to `'to_buy'` does *not* revert an already-upgraded Product reference back to a Food. The brand is still correct; the item simply isn't bought yet.

## Rationale

The entire point of scanning over manual ticking is to capture *what was actually bought*. Preserving the scanned Product means the pantry receives the real branded item — with a barcode — which enables future scan-to-deduct and per-brand price history. Keeping the planning experience in terms of generic Foods keeps list-building fast and friendly ("Milk", not "which of 40 milk SKUs"). Upgrading in place reconciles the two without the user ever managing the distinction.

The upgrade also composes with the rest of the model: because transfer is 1:1 (see Pantry-Gap Fill / Shopping Trip Completion in CONTEXT.md), one upgraded line yields exactly one Product Pantry Item, and the Barcode Creation Modal already solves the "scanned barcode has no Product" case.

## Alternatives considered

**Check-off discards the brand.** Scanning would only *find and tick* the matching planned line; the specific Product scanned would be thrown away and the pantry would receive the generic Food. Rejected because it discards the single most valuable thing a scan captures — the exact item bought and its barcode — reducing the scanner to a fancy checkbox.

**Scan always appends a separate bought item.** The scan would never touch planned lines; it would add a distinct `'product'` "bought" entry, leaving the planned "Milk" line untouched. Rejected because it produces duplicated, confusing lists ("why is Milk still unchecked when I just scanned milk?") and pushes reconciliation onto the user.

## Consequences

- A Shopping List Item's `sourceType` is **mutable**: a `'food'` line can become a `'product'` line during an active trip. Code reading these items must not assume the reference is stable across the item's lifetime.
- The `foodId` / `productId` columns on a Shopping List Item can both be transiently meaningful across the upgrade; the live `sourceType` is the source of truth for which reference applies.
- Completion transfers the *post-upgrade* reference, so a line planned as a Food can legitimately produce a **Product** Pantry Item.
- Scan-to-Buy depends on the existing barcode-scan and Barcode Creation Modal infrastructure; no new scanning stack is introduced.
- Manual check-off and Scan-to-Buy are deliberately asymmetric (only the latter mutates the reference). This is intended, not an inconsistency to "fix" later.
