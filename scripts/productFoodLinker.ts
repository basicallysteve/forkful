/**
 * Pure parts of the product -> food linker (scripts/link-product-foods.ts):
 * name normalisation, candidate selection, prompt building and response parsing.
 * No DB or network access here; those are injected so tests can mock them.
 */

import { Models, AIBudgetExhaustedError } from '@/lib/ai'

export type Candidate = { id: number; name: string }

export const MAX_CANDIDATES = 5

/** Default model (the canonical Haiku in src/lib/ai.ts); override with LINK_PRODUCT_FOODS_MODEL. */
export const DEFAULT_LINK_MODEL = Models.anthropicHaiku.model

export function resolveLinkModel(env: Record<string, string | undefined>): string {
  return env.LINK_PRODUCT_FOODS_MODEL?.trim() || DEFAULT_LINK_MODEL
}

// Trailing weight/count patterns: "3 LB", "12OZ", "500G", "2 CT", "1.5 KG", "250 ML"
const WEIGHT_SUFFIX_RE = /[\s,]+[\d.]+\s*(?:fl\.?\s*oz|fluid\s*ounces?|gallons?|liters?|litres?|milliliters?|millilitres?|ml|oz|lbs?|kg|g\b|ct|pk|packs?|count)\b\.?/gi

// USDA-style brand prefix: uppercase word(s) before the first comma, e.g. "TYSON, CHICKEN BREAST".
// Needs 2+ chars before the comma so initials like "A," are kept.
const BRAND_PREFIX_RE = /^[A-Z][A-Z\s&'.]{1,}\s*,\s*/

/** Strip the brand prefix and weight suffix from a branded product name. */
export function preprocessName(name: string): string {
  const cleaned = name.replace(WEIGHT_SUFFIX_RE, ' ').replace(BRAND_PREFIX_RE, '')
  return cleaned.replace(/\s+/g, ' ').trim()
}

/** Escape LIKE wildcards so product names cannot widen the search. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, c => `\\${c}`)
}

/** Search terms to try in order: the full cleaned name, then its first two words. */
export function candidateSearchTerms(cleanedName: string): string[] {
  const terms = [cleanedName]
  const firstWords = cleanedName.split(/\s+/).slice(0, 2).join(' ')
  if (firstWords.length >= 3 && firstWords !== cleanedName) terms.push(firstWords)
  return terms
}

/** Try each search term until one yields candidates. `search` queries the foods table. */
export async function selectCandidates(
  cleanedName: string,
  search: (term: string, limit: number) => Promise<Candidate[]>,
): Promise<Candidate[]> {
  for (const term of candidateSearchTerms(cleanedName)) {
    const found = await search(term, MAX_CANDIDATES)
    if (found.length > 0) return found.slice(0, MAX_CANDIDATES)
  }
  return []
}

export const LINK_SYSTEM_PROMPT = `You are a food classifier. Given a branded product name, select the best matching generic food from a numbered list of candidates.

Output ONLY the numeric ID of the best match, or the word "none" if no candidate is a reasonable match. No explanation, no punctuation, no extra text.

Rules:
- Match on the core food item, ignoring brand name, flavoring, and package size
- A match is appropriate when the branded product is a specific version of the generic food
- Output "none" when no candidate is a close match or the product is a supplement, pet food, or non-food item

Examples:
Product "Tyson Boneless Skinless Chicken Breast" + candidates including "Chicken Breast (boneless, skinless, raw)" -> output: 42
Product "Kind Dark Chocolate Nuts & Sea Salt Bar" + no close food match -> output: none`

export function buildUserMessage(productName: string, candidates: Candidate[]): string {
  return [
    `<product_name>${productName}</product_name>`,
    '<candidates>',
    candidates.map(c => `${c.id}: ${c.name}`).join('\n'),
    '</candidates>',
  ].join('\n')
}

/** Parse the model reply; only IDs from the candidate list are accepted. */
export function parseChoice(response: string, candidates: Candidate[]): number | null {
  const trimmed = response.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const id = parseInt(trimmed, 10)
  return candidates.some(c => c.id === id) ? id : null
}

export type CompleteFn = (args: { systemPrompt: string; userMessage: string }) => Promise<string>

/** Ask the model to pick a candidate. Never calls the model without candidates. */
export async function pickBestFood(
  productName: string,
  candidates: Candidate[],
  completeFn: CompleteFn,
): Promise<number | null> {
  if (candidates.length === 0) return null
  const response = await completeFn({
    systemPrompt: LINK_SYSTEM_PROMPT,
    userMessage: buildUserMessage(productName, candidates),
  })
  return parseChoice(response, candidates)
}

/**
 * Parse an integer CLI flag. Returns null when `raw` is not an integer >= min.
 * Used for --limit/--concurrency (min 1) and --after-id (min 0).
 */
export function parseIntFlag(raw: string, min: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= min ? n : null
}

export type SettledBatch<R> = {
  /** Results of every item that completed (already paid for), in input order. */
  results: R[]
  /** Number of leading items that all completed; the cursor is the id of item `prefix - 1`. */
  prefix: number
  /** True when any item failed because the AI budget ran out. */
  budgetExhausted: boolean
  /** A non-budget failure to rethrow after the completed results are saved. */
  otherError: unknown
}

/** Split Promise.allSettled output so completed work is kept when a sibling hits the budget limit. */
export function settleBatch<R>(settled: PromiseSettledResult<R>[]): SettledBatch<R> {
  const results: R[] = []
  let prefix = -1
  let budgetExhausted = false
  let otherError: unknown = undefined
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      results.push(s.value)
      return
    }
    if (prefix < 0) prefix = i
    if (s.reason instanceof AIBudgetExhaustedError) budgetExhausted = true
    else if (otherError === undefined) otherError = s.reason
  })
  return { results, prefix: prefix < 0 ? settled.length : prefix, budgetExhausted, otherError }
}
