# Cross-category Measurements derived at runtime from Density

When a Food or Product has a Density set, Standard Units from the opposite category (mass↔volume) are included in its effective Measurement list. These cross-category units are computed at runtime and are not stored in the DB.

## Considered Options

- **Store in DB:** When the user sets Density, write all opposite-category Standard Units into the `measurements` column immediately. They persist and can be deleted individually.
- **Derive at runtime (chosen):** The DB stores only measurements the author explicitly added. The application expands the list at read time by appending the other category's Standard Units whenever Density is present.

## Decision

Derive at runtime.

Density is the single source of truth for cross-category availability. Storing derived units in the DB would create two sources of truth — if Density is later removed, a cleanup step would be needed to delete the now-invalid units. Runtime derivation means removing Density automatically collapses the list back, with no DB side-effects. It also avoids a backfill migration for any existing Foods to which a user later adds Density.

## Consequences

`getAllowedUnits` (or its successor) must accept Density as an input and conditionally append the opposite category's Standard Units. Callers that render the Measurement picker must pass Density through. The stored `measurements` array remains narrowly scoped to what the author intentionally added.
