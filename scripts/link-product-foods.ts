#!/usr/bin/env bun
/**
 * Link Products to their parent Foods using AI-assisted matching.
 *
 * Usage:
 *   bun --env-file .env.local scripts/link-product-foods.ts
 *   bun --env-file .env.local scripts/link-product-foods.ts --dry-run
 *   bun --env-file .env.local scripts/link-product-foods.ts --limit 500 --concurrency 10
 *
 * For each unlinked Product (parentFoodId IS NULL):
 *   1. Preprocess the product name (strip brand prefix and weight suffixes)
 *   2. Search the foods table for up to MAX_CANDIDATES matches
 *   3. If no candidates: skip (fast-path, no LLM call)
 *   4. If candidates: ask Claude Haiku to pick the best match or return "none"
 *   5. Write parentFoodId on a match (unless --dry-run)
 *
 * Re-runnable: already-linked products (parentFoodId IS NOT NULL) are skipped.
 * Applies to all Products regardless of source (usda_branded, open_food_facts, manual).
 */

import { parseArgs } from 'node:util'
import { and, isNull, ilike, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products, foods } from '@/db/schema'
import { complete, Models, AIBudgetExhaustedError } from '@/lib/ai'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CANDIDATES = 5
const DEFAULT_CONCURRENCY = 5
const DEFAULT_LIMIT = Infinity

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'dry-run':   { type: 'boolean', default: false },
    limit:       { type: 'string' },
    concurrency: { type: 'string' },
  },
})

const DRY_RUN = args['dry-run'] ?? false
const LIMIT = args.limit ? parseInt(args.limit, 10) : DEFAULT_LIMIT
const CONCURRENCY = args.concurrency ? parseInt(args.concurrency, 10) : DEFAULT_CONCURRENCY

if (DRY_RUN) console.log('\n⚠  DRY RUN — no writes will be made\n')

// ── Name preprocessing ────────────────────────────────────────────────────────

// Trailing weight/count patterns: "3 LB", "12OZ", "500G", "2 CT", "1.5 KG", "250 ML"
const WEIGHT_SUFFIX_RE = /[\s,]+[\d.]+\s*(?:fl\.?\s*oz|fluid\s*ounces?|gallons?|liters?|litres?|milliliters?|millilitres?|ml|oz|lbs?|kg|g\b|ct|pk|packs?|count)\b\.?/gi

// USDA-style brand prefix: uppercase word(s) before the first comma
// e.g. "TYSON, CHICKEN BREAST" → "CHICKEN BREAST"
// Requires at least 2 chars before the comma to avoid stripping initials like "A,"
const BRAND_PREFIX_RE = /^[A-Z][A-Z\s&'.]{1,}\s*,\s*/

function preprocessName(name: string): string {
  let cleaned = name.replace(WEIGHT_SUFFIX_RE, ' ')
  cleaned = cleaned.replace(BRAND_PREFIX_RE, '')
  return cleaned.replace(/\s+/g, ' ').trim()
}

// ── Candidate search ──────────────────────────────────────────────────────────

async function findCandidates(cleanedName: string): Promise<{ id: number; name: string }[]> {
  const candidates = await db
    .select({ id: foods.id, name: foods.name })
    .from(foods)
    .where(and(isNull(foods.dateDeleted), ilike(foods.name, `%${cleanedName}%`)))
    .limit(MAX_CANDIDATES)

  if (candidates.length > 0) return candidates

  // Fallback: try first two content words if the full name matched nothing
  const firstWords = cleanedName.split(/\s+/).slice(0, 2).join(' ')
  if (firstWords.length < 3) return []

  return db
    .select({ id: foods.id, name: foods.name })
    .from(foods)
    .where(and(isNull(foods.dateDeleted), ilike(foods.name, `%${firstWords}%`)))
    .limit(MAX_CANDIDATES)
}

// ── AI linking ────────────────────────────────────────────────────────────────

const LINK_SYSTEM_PROMPT = `You are a food classifier. Given a branded product name, select the best matching generic food from a numbered list of candidates.

Output ONLY the numeric ID of the best match, or the word "none" if no candidate is a reasonable match. No explanation, no punctuation, no extra text.

Rules:
- Match on the core food item, ignoring brand name, flavoring, and package size
- A match is appropriate when the branded product is a specific version of the generic food
- Output "none" when no candidate is a close match or the product is a supplement, pet food, or non-food item

Examples:
Product "Tyson Boneless Skinless Chicken Breast" + candidates including "Chicken Breast (boneless, skinless, raw)" → output: 42
Product "Kind Dark Chocolate Nuts & Sea Salt Bar" + no close food match → output: none`

async function pickBestFood(
  productName: string,
  candidates: { id: number; name: string }[],
): Promise<number | null> {
  const userMessage = [
    `<product_name>${productName}</product_name>`,
    '<candidates>',
    candidates.map(c => `${c.id}: ${c.name}`).join('\n'),
    '</candidates>',
  ].join('\n')

  const response = await complete({
    systemPrompt: LINK_SYSTEM_PROMPT,
    userMessage,
    aiModel: Models.anthropicHaiku,
  })

  const trimmed = response.trim().toLowerCase()
  if (trimmed === 'none' || trimmed === '') return null

  const parsed = parseInt(response.trim(), 10)
  if (isNaN(parsed)) return null

  // Validate the returned ID is actually in our candidate list
  return candidates.some(c => c.id === parsed) ? parsed : null
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('\nQuerying unlinked products…')
const unlinked = await db
  .select({ id: products.id, name: products.name, source: products.source })
  .from(products)
  .where(and(isNull(products.parentFoodId), isNull(products.dateDeleted)))

const toProcess = unlinked.slice(0, LIMIT)
console.log(`  ${unlinked.length.toLocaleString()} unlinked products total`)
if (LIMIT < Infinity) console.log(`  Processing first ${LIMIT.toLocaleString()} (--limit)`)
console.log(`  Concurrency: ${CONCURRENCY}`)
console.log()

let linked = 0
let skippedNoCandidates = 0
let skippedNoMatch = 0
let errors = 0
let processed = 0

type Result = { productId: number; foodId: number | null; productName: string; foodName: string | null; reason: 'linked' | 'no-candidates' | 'no-match' | 'error' }

async function processProduct(product: { id: number; name: string; source: string }): Promise<Result> {
  const cleanedName = preprocessName(product.name)

  if (cleanedName.length < 2) {
    return { productId: product.id, foodId: null, productName: product.name, foodName: null, reason: 'no-candidates' }
  }

  let candidates: { id: number; name: string }[]
  try {
    candidates = await findCandidates(cleanedName)
  } catch {
    return { productId: product.id, foodId: null, productName: product.name, foodName: null, reason: 'error' }
  }

  if (candidates.length === 0) {
    return { productId: product.id, foodId: null, productName: product.name, foodName: null, reason: 'no-candidates' }
  }

  let foodId: number | null
  try {
    foodId = await pickBestFood(product.name, candidates)
  } catch (err) {
    if (err instanceof AIBudgetExhaustedError) throw err
    return { productId: product.id, foodId: null, productName: product.name, foodName: null, reason: 'error' }
  }

  if (foodId === null) {
    return { productId: product.id, foodId: null, productName: product.name, foodName: null, reason: 'no-match' }
  }

  const matchedFood = candidates.find(c => c.id === foodId)!
  return { productId: product.id, foodId, productName: product.name, foodName: matchedFood.name, reason: 'linked' }
}

// Process in concurrent batches
for (const batch of chunk(toProcess, CONCURRENCY)) {
  let results: Result[]
  try {
    results = await Promise.all(batch.map(p => processProduct(p)))
  } catch (err) {
    if (err instanceof AIBudgetExhaustedError) {
      console.error('\n✗ AI budget exhausted — stopping. Results so far will be committed.')
      break
    }
    throw err
  }

  for (const result of results) {
    processed++

    if (result.reason === 'linked') {
      if (DRY_RUN) {
        console.log(`  [DRY] "${result.productName}" → "${result.foodName}" (food #${result.foodId})`)
      } else {
        await db.update(products)
          .set({ parentFoodId: result.foodId, dateUpdated: new Date() })
          .where(eq(products.id, result.productId))
      }
      linked++
    } else if (result.reason === 'no-candidates') {
      skippedNoCandidates++
    } else if (result.reason === 'no-match') {
      skippedNoMatch++
    } else {
      errors++
    }
  }

  process.stdout.write(
    `\r  ${processed.toLocaleString()} / ${toProcess.length.toLocaleString()} — linked: ${linked}, no-candidates: ${skippedNoCandidates}, no-match: ${skippedNoMatch}, errors: ${errors}  `
  )
}

process.stdout.write('\n')

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────')
if (DRY_RUN) console.log('  DRY RUN — nothing written')
console.log(`  Processed:      ${processed.toLocaleString()}`)
console.log(`  Linked:         ${linked.toLocaleString()}`)
console.log(`  No candidates:  ${skippedNoCandidates.toLocaleString()}`)
console.log(`  No match (LLM): ${skippedNoMatch.toLocaleString()}`)
console.log(`  Errors:         ${errors}`)
console.log('─────────────────────────────────────────\n')

process.exit(0)
