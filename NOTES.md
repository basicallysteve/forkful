# Notes — teaching preferences & working memory

## Learner preferences
- Wants a **refresher**, not a from-scratch build — move at pace, don't belabour
  descriptive stats they already own.
- **Python examples in every lesson** (numpy/scipy/pandas). They read code fluently.
- Motivation is a specific, imminent goal: an advanced **applied** ML course.
  Keep everything tied to "where does this show up in ML?"

## Teaching stance chosen
- The through-line of the course is the **descriptive → probabilistic bridge**,
  because that is precisely their stated gap ("solid basics, shaky theory").
- Lessons stay short (working-memory sized), one win each, with a retrieval-practice
  self-check. Quiz answers kept equal-length to avoid formatting tells.

## Roadmap (tentative — reorder as the syllabus lands)
1. ✅ Expectation & Variance (random variables; sample stats as estimates) — lesson 0001
2. Distributions ML actually uses (Bernoulli, Binomial, Normal, Poisson) + scipy
3. The Normal, Central Limit Theorem, and why Gaussians are everywhere
4. Estimation: sample statistics as estimators; Maximum Likelihood (MLE)
5. Bias–Variance decomposition (the ML-central idea)
6. Conditional probability & Bayes (P(y|x), naive Bayes intuition)
7. Inference: sampling distributions, confidence intervals, hypothesis tests, p-values
8. Correlation, covariance, and the covariance matrix (feature relationships)

## To do
- Update MISSION.md when the ML syllabus arrives.
- Find a real course dataset to reuse across lessons.
