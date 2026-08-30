# 0001 — Baseline & course plan

**Date:** 2026-08-30
**Status:** current

## Context
User invoked `/teach` for "a refresher course on statistics, using python
examples, as I start my Machine Learning course soon." Workspace was empty; this
record captures the starting point that all future ZPD decisions build on.

## What we learned about the learner (from intake questions)
- **Statistics:** "Solid basics, shaky theory." Owns descriptive stats
  (mean, variance, named distributions). Growth areas: probability, inference,
  hypothesis testing.
- **Python:** "Comfortable." Reads numpy/pandas examples fluently; uses them
  occasionally. → Code examples can be concise, not hand-held.
- **Goal:** Advanced-level **Applied** Machine Learning course at university.
  Syllabus not yet seen.

## Key decision: the course through-line
Chose **"descriptive → probabilistic bridge"** as the spine, because it maps
exactly onto the stated gap. Each lesson re-casts something the learner already
computes (e.g. the sample mean) as its probabilistic form (E[X]) and shows where
that form appears in ML. Every lesson carries a Python example (mission is *applied*).

## Zone of proximal development — where we started
Lesson 1 = **Expectation & Variance as properties of random variables**, framing
the already-known sample mean/variance as *estimates* of E[X] and Var(X). This
is one small step past "solid basics" and is the atom under loss functions and
bias–variance, so it earns its place as lesson one.

## Insights to revisit
- **Update the mission when the syllabus lands.** Applied-advanced could lean
  Bayesian, or heavily toward evaluation metrics — that would reorder the roadmap
  in `NOTES.md`.
- Learner has not yet *done* a lesson — the "solid basics" self-assessment is
  unverified. Watch the first quiz results / follow-up questions to calibrate:
  if expectation feels too easy, skip ahead to estimation/MLE or bias–variance.

## Open threads
- No real dataset from the course yet; lessons use synthetic numpy data for now.
