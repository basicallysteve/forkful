# ADR 0004 — Sentry for error capture, minimal configuration

We need structured error observability before real users hit production. We chose Sentry with `@sentry/nextjs` because it covers all three Next.js surfaces (browser, server-side rendering, API routes) with a single SDK and automatic instrumentation via `withSentryConfig`.

## Scope constraint

Error capture only — no performance monitoring, no session replay. Both features add meaningful bundle size, event volume, and cost with no specific problem to justify them yet. They can be enabled later if a concrete need arises.

## Alternatives considered

**Performance monitoring** — deferred. Adds request tracing overhead and Sentry quota pressure. Worth adding when there's a known latency issue to diagnose.

**Session replay** — deferred. Records user screen activity; raises PII concerns and adds ~50KB to the client bundle. Not warranted for proactive monitoring.

**Manual instrumentation in `taskRunner`** — skipped in favour of automatic Next.js instrumentation. If automatic capture proves incomplete, `Sentry.captureException()` calls can be added to `taskRunner` later.
