# USDA name normalization backfill run as a Vercel cron, not a one-off CLI script

The 8,000 existing `source = 'usda'` rows in the `foods` table need their names normalized
(see ADR-0014). The normalization requires one Claude API call per food, making a single
synchronous run take ~3 hours — far beyond any reasonable local script or CI timeout.

## Considered Options

- **One-shot CLI script (rejected):** The `scripts/normalize-usda-food-names.ts` script runs
  to completion in a local terminal. Works for small datasets; impractical for 8,000 foods at
  45 RPM without leaving a machine running for hours. Fragile to network interruptions and has
  no notification when done.

- **Vercel cron route (chosen):** A cron route at `/api/cron/normalize-usda-names` fires
  hourly and processes 40 foods per invocation. The skip logic (`isUSDANameRaw`) makes each
  run idempotent — network interruptions lose at most one batch. Completion and credit
  exhaustion are signalled via Resend email to the admin address. No infrastructure beyond
  what the project already uses.

## Decision

Run the backfill as a Vercel cron (`0 * * * *`, hourly). Each invocation processes up to 40
un-normalized USDA foods — the safe ceiling for the Hobby-plan 60-second function timeout at
45 RPM. The cron is added to `vercel.json` temporarily and removed after the completion email
is received.

Two email signals:
- **Completion** — all `source = 'usda'` foods pass `isUSDANameRaw` check → email sent,
  cron can be removed from `vercel.json`.
- **Credit exhaustion (HTTP 402)** — Anthropic billing credits depleted → email sent with
  remaining count; cron resumes automatically once credits are refilled (next hourly run).
  Transient rate-limit errors (429) are swallowed; the next run retries them.

## Consequences

- At 40 foods/hour the backfill completes in ~200 hours (~8 days) on Hobby plan.
- The CLI script (`scripts/normalize-usda-food-names.ts`) remains useful for local testing
  and for running the migration faster on a machine with no timeout constraints.
- `isUSDANameRaw` is exported from `src/lib/usda.ts` so both the script and the cron share
  the same skip predicate.
- `AnthropicCreditExhaustedError` is exported from `src/lib/usda.ts` so callers can
  distinguish billing failure from transient errors.
