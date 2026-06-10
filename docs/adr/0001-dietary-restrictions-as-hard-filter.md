# ADR 0001: Dietary Restrictions as a Hard Filter, Not a Ranking Signal

## Status
Accepted

## Context
Users can set Dietary Restrictions on their profile (e.g. `gluten-free`, `vegan`). Recipes can be tagged with Dietary Tags by their author. When a logged-in user with Dietary Restrictions browses the recipes list, we needed to decide how those restrictions interact with what they see.

Two approaches were considered:

1. **Hard filter (default on, session-toggle off)** — recipes that do not cover all of the user's restrictions are hidden by default. The user can explicitly toggle the filter off to browse unrestricted for their current session.
2. **Soft ranking signal** — all recipes are shown, but matching recipes are ranked higher. No content is hidden.

## Decision
Dietary Restrictions are applied as a **hard filter**, enabled by default, with a session-only toggle to disable it.

Cuisine Preferences, by contrast, are treated as a soft ranking signal (the For You section surfaces matching recipes without hiding others).

## Rationale
Dietary restrictions represent constraints, not preferences — a user who is `gluten-free` cannot safely eat recipes that aren't. Surfacing non-compliant recipes by default, even ranked lower, puts the burden on the user to manually avoid them on every browse session.

The session-only toggle acknowledges that users may occasionally want to browse freely (e.g. cooking for others) without permanently changing their profile. A persistent toggle would imply the restriction no longer applies, which conflates "I want to browse freely right now" with "I am no longer gluten-free."

Cuisine Preferences do not carry the same constraint semantics — preferring Italian food does not mean you refuse to eat Mexican — so a soft ranking signal is appropriate there.

## Consequences
- Recipes with no Dietary Tags are always shown (untagged ≠ non-compliant).
- Authors who do not tag their recipes will not be filtered out, which may occasionally surface non-compliant recipes. This is acceptable given tagging is voluntary.
- The session toggle must be clearly labelled so users understand it is temporary.
