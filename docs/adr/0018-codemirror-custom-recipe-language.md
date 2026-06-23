# ADR-0018: Custom CodeMirror 6 Language for Markdown Recipe Import Editor

**Status:** Accepted

## Context

The Markdown Recipe Import editor needs syntax highlighting. The recipe template has a fixed structure (metadata block, `## Ingredients` section, `## Steps` section) with section-specific validation rules — particularly ingredient lines, where quantity, unit, and food name are distinct tokens with distinct validity constraints.

## Decision

Use **CodeMirror 6** with a **custom `StreamParser` language mode** rather than a generic markdown highlighter. The parser tracks which section of the template the cursor is in and applies different tokenization rules per section:

- **Metadata block** (before the first `##`): key/value pairs (`meal:`, `serves:`, etc.)
- **`## Ingredients` section**: each `- <quantity> <unit> <food name>` line is tokenized into four parts — bullet, number, unit keyword, food name — with invalid tokens (non-numeric quantity, unrecognised unit) styled as error tokens
- **`## Steps` section**: numbered list items tokenized as position + instruction text
- **`## Description` section**: plain text

## Rationale

- **Inline feedback reduces preview-step friction.** If the user sees `abc` styled as an error token in an ingredient line before they submit, they fix it immediately — the Recipe Import Preview doesn't need to handle as many parse failures.
- **Section-aware highlighting isn't possible with generic markdown.** A generic markdown parser has no concept of "this line is inside `## Ingredients`" and cannot distinguish a valid unit from an arbitrary word.
- **CodeMirror 6's `StreamParser` is the right scope.** A full Lezer grammar would be overkill for a template with 4 sections; `StreamParser` (from `@codemirror/language`) handles stateful, line-by-line tokenization with minimal boilerplate.

## Alternatives Considered

- **Generic markdown highlighting (`@codemirror/lang-markdown`):** Fast to set up, but highlights markdown syntax only — no awareness of ingredient structure, no error tokens for invalid quantities or units.
- **`@uiw/react-md-editor`:** Turnkey, includes a live preview pane. Rejected because the preview pane would show rendered markdown, not the structured Recipe Import Preview (ingredient resolution UI, editable metadata fields).
- **Plain textarea:** No dependency, but no guidance for the user while writing. Validation deferred entirely to the Preview step.
- **Monaco Editor:** Too heavy (~2MB) for a single input field.

## Consequences

- A custom `StreamParser` must be maintained alongside the template format. If the template format changes (e.g. a new section is added), the parser must be updated in sync.
- The known unit list used by the parser (`g`, `kg`, `oz`, `lb`, `mg`, `ml`, `l`, `cup`, `Tbs`, `tsp`, `fl-oz`) must be kept in sync with `src/utils/unitConversion.ts`.
- `@uiw/react-codemirror` and `@codemirror/language` are added as dependencies.
