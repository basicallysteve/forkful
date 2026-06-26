import Anthropic from '@anthropic-ai/sdk'

/** Thrown by any provider when billing credits / quota are exhausted. */
export class AIBudgetExhaustedError extends Error {
  constructor() {
    super('AI provider budget exhausted')
    this.name = 'AIBudgetExhaustedError'
  }
}

// ── Model registry ────────────────────────────────────────────────────────────

type Provider = 'anthropic' // | 'google' when added

export type AIModel = { provider: Provider; model: string }

/** Named model configurations. Features import one of these and pass it to complete(). */
export const Models = {
  anthropicHaiku: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  anthropicOpus:  { provider: 'anthropic', model: 'claude-opus-4-8' },
} satisfies Record<string, AIModel>

// ── Anthropic ─────────────────────────────────────────────────────────────────

let _anthropicClient: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropicClient
}

async function callAnthropic({ model, systemPrompt, userMessage }: { model: string; systemPrompt: string; userMessage: string }): Promise<string> {
  try {
    const message = await getAnthropicClient().messages.create({
      model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    return message.content.find(b => b.type === 'text')?.text?.trim() ?? ''
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status === 402) throw new AIBudgetExhaustedError()
    throw err
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Send a single-turn AI Completion. See ADR-0016 and the CONTEXT.md entry for
 * "AI Completion" for conventions callers must follow (XML tags for user data,
 * caller-owned output validation, AIBudgetExhaustedError handling).
 */
export async function complete({ systemPrompt, userMessage, aiModel }: {
  systemPrompt: string;
  userMessage: string;
  aiModel: AIModel;
}): Promise<string> {
  if (aiModel.provider === 'anthropic') return callAnthropic({ model: aiModel.model, systemPrompt, userMessage })
  throw new Error(`Unknown AI provider: "${aiModel.provider}"`)
}
