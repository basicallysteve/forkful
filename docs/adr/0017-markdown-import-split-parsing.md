# ADR-0017: Split Markdown Recipe Import Parsing Between Client and Server

**Status:** Accepted

## Context

Markdown Recipe Import requires two distinct operations:
1. Parsing the markdown document structure into fields (title, metadata, ingredient strings, step text)
2. Resolving each ingredient string against Food records in the database

These could be done entirely client-side (if the food list were fetched to the client), entirely server-side (one API call with the raw markdown), or split between the two layers.

## Decision

Parse the markdown document structure on the **client** (JavaScript), then send the extracted ingredient strings to a **server-side API endpoint** (`POST /api/recipes/import/resolve-ingredients`) for Food lookup.

The client never queries the DB directly. The server never receives raw markdown — only the already-parsed ingredient strings.

## Rationale

- **DB access must stay server-side.** Ingredient resolution requires querying the `foods` table; exposing a bulk query endpoint broad enough to do this client-side would be an unnecessary surface.
- **Markdown parsing has no server-side benefit.** Extracting title/metadata/steps from markdown is pure string manipulation with no I/O — doing it in the browser avoids a round-trip and makes the UI feel instant.
- **Enables incremental Preview UX.** With client-side parsing, the Recipe Import Preview can render immediately (showing structure) while the ingredient resolution request is in flight, rather than waiting for the full round-trip before showing anything.

## Alternatives Considered

- **All server-side:** Simpler API contract (one call, raw markdown in), but Preview can't render until the full round-trip completes, and the server must own a markdown parser dependency.
- **All client-side:** No server round-trip needed for resolution, but requires fetching enough Food data to the browser to do fuzzy matching — impractical at any realistic food catalogue size.

## Consequences

- A new API endpoint (`POST /api/recipes/import/resolve-ingredients`) accepts an array of raw ingredient strings and returns structured resolution results (matched Food, candidates, or unresolved).
- The client markdown parser is a standalone utility (`src/utils/recipeMarkdownParser.ts`) with no server dependency — testable in isolation.
- If the resolution endpoint is slow, the Preview must handle a loading state while ingredient rows resolve.
