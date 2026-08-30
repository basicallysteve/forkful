# 0002 — Worked Lesson 1; variance-scaling misconception caught

**Date:** 2026-08-30
**Status:** current
**Relates to:** Lesson 0001 (Expectation & Variance)

## What happened
User worked through Lesson 1 interactively (retrieval, not recognition). Scored
2/3 on the checkpoint set.

| Q | Skill tested | Result |
|---|---|---|
| Q1 | E[X] as convergence target vs. sample-mean estimate | ✓ correct idea; slightly vague on "what closes the gap" (didn't name more-data / LLN) |
| Q2 | Linearity of expectation, E[2X−1] | ✓ correct (7) |
| Q3 | Variance scaling, Var(2X−1) | ✗ answered 18 (did 2·9), correct is 36 (2²·9) |

## Key insight to carry forward
**Misconception: scales variance linearly instead of quadratically.** User applied
`a` where the rule needs `a²`. Root cause is the common one — treating Var like a
linear operator. Retaught with the σ↔Var hook: **standard deviation scales by `a`,
variance by `a²`** (because `Var = σ²`, and variance is built on *squared* distances).
Also reinforced: the additive constant `b` shifts data without changing spread.

- Confirmed solid: linearity of expectation; the descriptive→probabilistic bridge
  (sample mean estimates E[X]).
- Watch for recurrence: any future lesson touching variance propagation
  (bias–variance decomposition, sums of independent variables, standardization /
  z-scores, variance of an estimator). Re-test `Var(aX+b)` via spaced repetition
  in Lesson 2 or 3 before relying on it.
- Q1 nuance: reinforce the Law of Large Numbers explicitly next time — the user has
  the intuition but hasn't attached the name/mechanism ("more data closes the gap").

## Implication for ZPD
Baseline "solid basics, shaky theory" is confirmed accurate: computation and
linear reasoning are fluent; the shakiness is in the *properties* (quadratic
scaling, why estimators behave as they do). Lesson 2 (distributions) can proceed,
but weave one spaced `Var(aX+b)` retrieval into it.
