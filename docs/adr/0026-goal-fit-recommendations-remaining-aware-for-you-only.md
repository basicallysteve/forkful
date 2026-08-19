# ADR-0026: Goal-fit recommendations are remaining-aware and For-You-only

**Status:** Accepted

## Context

With a daily intake ledger in place (see ADR-0025), the For You Section should recommend Recipes that help a User hit their Nutrition Goal. The scoring and its placement carry two decisions that a future reader would otherwise question, since the app already has a second recommendation surface (the Recipe Suggestion Emails) that this feature deliberately does *not* touch, and since the naive "match the goal" scorer has a subtle bug. See the Goal Fit and For You Section terms in `CONTEXT.md`.

## Decision 1: Goal Fit is remaining-aware and lives on the For You Section only

Goal Fit scores against **remaining budget** = Nutrition Goal − the day's logged intake (summed from today's Food Log Entries), so it changes through the day. It is applied to the live For You Section only; the Recipe Suggestion Emails keep their existing three signals (cuisine match, pantry overlap, dietary hard filter).

**Rationale:** The value of the feature comes from the real-time ledger we just built — "you're 40g protein short with 600 kcal left" is far more useful than a static "you like high-protein recipes." But "remaining today" is a live concept: at 6am Monday, before the User has eaten, it is meaningless. A weekly digest is a point-in-time artifact, so remaining-aware scoring belongs on the live page and not in the email. Splitting the surfaces keeps each honest rather than forcing a live signal into a batch context.

**Alternative considered:** An abstract, log-independent "goal shape" signal (bias toward recipes whose macro *ratios* match the goal's) usable identically in both surfaces. Rejected for the live section because it throws away the Daily Log; it remains the natural option if the email ever gets a weaker version later.

## Decision 2: Goal Fit is a co-equal driver of the For You Section, not a re-rank within cuisine matches

The For You Section now appears for Users with a Cuisine Preference **or** a Nutrition Goal. A Recipe qualifies as a candidate by matching cuisine **or** fitting the goal, and the two signals are weighted as roughly co-equal contributors (Dietary Restriction filter always hard on top).

**Rationale:** Gating Goal Fit behind *also* having cuisine preferences set would strand exactly the health-focused Users the feature targets — a goals-only User would see an empty section. Making it a co-equal driver means a goals-only User gets goal-driven recommendations, a cuisine-only User is unaffected, and a User with both gets a blend. This does change the For You Section's identity (it is no longer purely cuisine-driven), which is recorded in the glossary.

**Alternative considered:** Re-rank only — keep "recipes matching my cuisine" as the candidate set and let Goal Fit merely reorder it. Rejected because it does nothing for a User who set goals but no cuisine preferences.

## Decision 3: Scoring is gap-fill with a calorie ceiling, protein weighted as a floor

A Recipe's Per-Serving Nutrition is rewarded for closing the macros the User is short on — protein weighted highest — and penalized when per-serving calories exceed remaining calories. When remaining calories are already ≤ 0, Goal Fit stops boosting and, if anything, favors the lowest-calorie options.

**Rationale:** The goals are not all the same kind of number. Protein is typically a floor ("hit at least 140g") while calories are a ceiling ("stay under 2000"). A scorer treating every goal as "get as close as possible" would recommend a 1,400-kcal recipe when 300 kcal remain, because it "fills the calorie gap." Respecting the floor/ceiling asymmetry avoids that, and the model stays explainable in one sentence — which matters because the section labels *why* a Recipe was surfaced ("High protein · fits your remaining calories"). Refusing to boost once the User is capped keeps the tracker from cheerleading eating more.

**Alternative considered:** Pure proximity (reward per-serving macros closest to remaining amounts, all treated identically). Rejected because it commits the overshoot bug above and cannot express "protein is a target, calories are a limit."

## Consequences

- Only Recipes that are Nutrition Complete **and** have Serves set are Goal-Fit-eligible (both required for trustworthy Per-Serving Nutrition). Ineligible Recipes get no Goal Fit boost but may still appear via cuisine match.
- The For You Section query gains a dependency on the current day's Food Log Entries (to compute remaining budget) — a coupling the Recipe Suggestion Emails do not take on.
- Goal Fit is inert when the User has no Nutrition Goal, leaving the For You Section cuisine-driven as before — no regression for existing users.
- Exact signal weights start roughly equal and are expected to be tuned; the floor/ceiling structure of the scorer is the stable part, the constants are not.
