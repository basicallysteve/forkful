#!/usr/bin/env bun
/**
 * Link unlinked Products to a parent Food using AI-assisted matching (ADR 0027).
 *
 * Usage:
 *   bun link:product-foods -- --dry-run --limit 50   # preview, no DB writes
 *   bun link:product-foods -- --limit 500 --concurrency 10
 *   bun link:product-foods:prod                      # deliberately targets production
 *
 * Flags: --dry-run, --limit N, --concurrency N, --source <manual|open_food_facts|usda_branded>
 * (--source restricts the run to one product source; default is all sources, per ADR 0027).
 * Env: ANTHROPIC_API_KEY, optional LINK_PRODUCT_FOODS_MODEL.
 *
 * Only products with parentFoodId IS NULL are processed, so it is re-runnable.
 * No LLM call is made for a product with no candidate foods.
 */

import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { and, eq, ilike, isNull } from 'drizzle-orm'
import { assertSafeSeedTarget } from './seedGuard'
import { db } from '@/db'
import { products, foods } from '@/db/schema'
import { complete, AIBudgetExhaustedError } from '@/lib/ai'
import {
  preprocessName, escapeLike, selectCandidates, pickBestFood, resolveLinkModel, type Candidate,
} from './productFoodLinker'

// Refuse to touch production unless explicitly allowed (see seedGuard.ts).
assertSafeSeedTarget(
  process.env,
  existsSync('.env.production') ? readFileSync('.env.production', 'utf-8') : null,
)

const SOURCES = ['manual', 'open_food_facts', 'usda_branded'] as const
type Source = (typeof SOURCES)[number]

const { values: args } = parseArgs({
  args: process.argv.slice(2).filter(a => a !== '--'),
  options: {
    'dry-run':   { type: 'boolean', default: false },
    limit:       { type: 'string' },
    concurrency: { type: 'string' },
    source:      { type: 'string' },
  },
})

function positiveInt(flag: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`Error: --${flag} must be a positive integer (got "${raw}")`)
    process.exit(1)
  }
  return n
}

const DRY_RUN = args['dry-run'] ?? false
const LIMIT = positiveInt('limit', args.limit, Infinity)
const CONCURRENCY = positiveInt('concurrency', args.concurrency, 5)
if (args.source && !SOURCES.includes(args.source as Source)) {
  console.error(`Error: --source must be one of ${SOURCES.join(', ')}`)
  process.exit(1)
}
const SOURCE = args.source as Source | undefined
const MODEL = { provider: 'anthropic', model: resolveLinkModel(process.env) } as const

if (DRY_RUN) console.log('\nDRY RUN: no database writes will be made\n')

async function searchFoods(term: string, limit: number): Promise<Candidate[]> {
  return db
    .select({ id: foods.id, name: foods.name })
    .from(foods)
    .where(and(isNull(foods.dateDeleted), ilike(foods.name, `%${escapeLike(term)}%`)))
    .limit(limit)
}

type Reason = 'linked' | 'no-candidates' | 'no-match' | 'error'
type Result = { productId: number; productName: string; foodId: number | null; foodName: string | null; reason: Reason }

async function processProduct(product: { id: number; name: string }): Promise<Result> {
  const base = { productId: product.id, productName: product.name, foodId: null, foodName: null }
  const cleaned = preprocessName(product.name)
  if (cleaned.length < 2) return { ...base, reason: 'no-candidates' }

  let candidates: Candidate[]
  try {
    candidates = await selectCandidates(cleaned, searchFoods)
  } catch {
    return { ...base, reason: 'error' }
  }
  if (candidates.length === 0) return { ...base, reason: 'no-candidates' }

  let foodId: number | null
  try {
    foodId = await pickBestFood(product.name, candidates, ({ systemPrompt, userMessage }) =>
      complete({ systemPrompt, userMessage, aiModel: MODEL }))
  } catch (err) {
    if (err instanceof AIBudgetExhaustedError) throw err
    return { ...base, reason: 'error' }
  }
  if (foodId === null) return { ...base, reason: 'no-match' }
  return { ...base, foodId, foodName: candidates.find(c => c.id === foodId)?.name ?? null, reason: 'linked' }
}

console.log('\nQuerying unlinked products…')
const conditions = [isNull(products.parentFoodId), isNull(products.dateDeleted)]
if (SOURCE) conditions.push(eq(products.source, SOURCE))
const baseQuery = db.select({ id: products.id, name: products.name }).from(products).where(and(...conditions))
const toProcess = await (LIMIT < Infinity ? baseQuery.limit(LIMIT) : baseQuery)
console.log(`  ${toProcess.length} unlinked products to process (source: ${SOURCE ?? 'all'}, concurrency ${CONCURRENCY}, model ${MODEL.model})\n`)

const counts: Record<Reason, number> = { linked: 0, 'no-candidates': 0, 'no-match': 0, error: 0 }
let processed = 0

for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
  let results: Result[]
  try {
    results = await Promise.all(toProcess.slice(i, i + CONCURRENCY).map(processProduct))
  } catch (err) {
    if (err instanceof AIBudgetExhaustedError) {
      console.error('\nAI budget exhausted, stopping. Links made so far are kept.')
      break
    }
    throw err
  }
  for (const r of results) {
    processed++
    counts[r.reason]++
    if (r.reason !== 'linked') continue
    if (DRY_RUN) {
      console.log(`  [DRY] "${r.productName}" -> "${r.foodName}" (food #${r.foodId})`)
    } else {
      await db.update(products).set({ parentFoodId: r.foodId, dateUpdated: new Date() }).where(eq(products.id, r.productId))
    }
  }
  process.stdout.write(`\r  ${processed} / ${toProcess.length}  linked: ${counts.linked}, no-candidates: ${counts['no-candidates']}, no-match: ${counts['no-match']}, errors: ${counts.error}  `)
}

process.stdout.write('\n')
console.log(`\n${DRY_RUN ? 'DRY RUN, nothing written. ' : ''}Processed ${processed}; linked ${counts.linked}; no candidates ${counts['no-candidates']}; no match ${counts['no-match']}; errors ${counts.error}\n`)
process.exit(0)
