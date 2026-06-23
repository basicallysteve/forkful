# Hand-rolled AI adapter over Vercel AI SDK

All AI text-generation calls in the app flow through a single `complete(systemPrompt, userMessage, model)` function in `src/lib/ai.ts`. The caller selects a named model configuration from the `Models` registry exported by that module (e.g. `Models.anthropicHaiku`). Each provider implementation lives as a private function inside that module; callers never import an SDK directly. Different features can use different providers by passing different `Models` entries — there is no global provider setting.

## Considered Options

- **Vercel AI SDK (`ai` package):** Unified API across providers with built-in `generateText` / `streamText`. Rejected because it adds a dependency layer before the app has enough AI features to justify it. The app currently has one AI task in production and one planned; the Vercel SDK earns its complexity cost at 3–4 features with different shapes. It remains the right upgrade path when that threshold is reached.
- **Hand-rolled adapter (chosen):** A thin module that owns provider selection and error normalisation. Swapping providers is a one-line env var change. Callers get a stable `(systemPrompt, userMessage) → Promise<string>` contract regardless of which SDK sits underneath.

## Consequences

- Callers are responsible for output validation — the adapter returns whatever the model returns; domain-specific checks (e.g. `isUSDANameRaw`) live in the caller.
- User-supplied data must be wrapped in XML tags inside `userMessage` at the call site — this is the project-wide defence against prompt injection and must be maintained by convention.
- Provider-specific errors are normalised to `AIBudgetExhaustedError` (thrown on billing quota exhaustion by any provider). All other errors are logged and the raw description / empty string is returned as a fallback; callers must not assume a throw on transient failure.
- `@anthropic-ai/sdk` remains a direct dependency; a Google provider would add `@google/generative-ai`. Both coexist until the Vercel AI SDK migration, at which point both are replaced.
