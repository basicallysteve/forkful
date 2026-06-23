#!/usr/bin/env bun
/**
 * One-time migration: normalize USDA food names in the `foods` table.
 *
 * Queries all rows with source = 'usda', calls Claude to produce a
 * human-readable name for each, and updates name + slug in place.
 *
 * Usage:
 *   bun --env-file .env.local scripts/normalize-usda-food-names.ts
 *
 * Options:
 *   --dry-run   Print proposed changes without writing to the DB
 *   --batch N   Number of concurrent Claude calls (default: 5)
 *
 * Re-runnable: already-normalized names (no ALL-CAPS tokens) are skipped.
 * LLM failures fall back to the raw description; those rows are logged at the end.
 */

import { parseArgs } from 'node:util'
import { isNull, eq } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import { normalizeUSDAFoodName, isUSDANameRaw, AnthropicCreditExhaustedError } from '@/lib/usda'
import { toSlug } from '@/utils/slug'

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'dry-run': { type: 'boolean', default: false },
    batch: { type: 'string', default: '5' },
  },
})

const DRY_RUN = args['dry-run']
const CONCURRENCY = Math.max(1, parseInt(args.batch ?? '5', 10))


function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function progress(done: number, total: number) {
  const pct = Math.round((done / total) * 100)
  process.stdout.write(`\r  ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)  `)
}

// Sliding-window rate limiter. Serialises the acquire() check so concurrent
// callers don't all see the same window state before any of them have recorded.
class RateLimiter {
  private timestamps: number[] = []
  private chain = Promise.resolve()

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  throttle<T>(fn: () => Promise<T>): Promise<T> {
    const slot = this.chain.then(async () => {
      while (true) {
        const now = Date.now()
        this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)
        if (this.timestamps.length < this.limit) {
          this.timestamps.push(now)
          return
        }
        const waitMs = this.windowMs - (now - this.timestamps[0]) + 50
        await new Promise(r => setTimeout(r, waitMs))
      }
    })
    this.chain = slot.then(() => {}, () => {})
    return slot.then(() => fn())
  }
}

// ── Fetch all non-deleted USDA foods ─────────────────────────────────────────

console.log('\nFetching USDA foods from database…')

const allFoods = await db
  .select({ id: foods.id, name: foods.name, slug: foods.slug, source: foods.source })
  .from(foods)
  .where(isNull(foods.dateDeleted))

const allSlugs = new Set(allFoods.map(r => r.slug).filter(Boolean) as string[])
const candidates = allFoods.filter(r => r.source === 'usda')
const toProcess = candidates.filter(r => isUSDANameRaw(r.name))
const alreadyNormalized = candidates.length - toProcess.length

console.log(`  ${candidates.length.toLocaleString()} USDA foods total`)
console.log(`  ${alreadyNormalized.toLocaleString()} already normalized (skipped)`)
console.log(`  ${toProcess.length.toLocaleString()} need normalization`)

if (toProcess.length === 0) {
  console.log('\nNothing to do.\n')
  process.exit(0)
}

if (DRY_RUN) {
  console.log('\n[dry-run] Sampling first 5 names that would be normalized:')
  for (const row of toProcess.slice(0, 5)) {
    console.log(`  "${row.name}"`)
  }
  console.log('\n[dry-run] No changes written.\n')
  process.exit(0)
}

// ── Normalize in concurrent batches ──────────────────────────────────────────

const RATE_LIMIT = 45 // stay safely under the 50 RPM API limit
const limiter = new RateLimiter(RATE_LIMIT, 60_000)

console.log(`\nNormalizing with concurrency=${CONCURRENCY}, rate limit=${RATE_LIMIT}/min…`)

type Result = { id: number; oldName: string; newName: string; newSlug: string; failed: boolean }
const results: Result[] = []
let done = 0

let creditExhausted = false
for (const batch of chunk(toProcess, CONCURRENCY)) {
  if (creditExhausted) break
  await Promise.all(
    batch.map(async row => {
      if (creditExhausted) return
      let newName: string
      try {
        newName = await limiter.throttle(() => normalizeUSDAFoodName(row.name))
      } catch (err) {
        if (err instanceof AnthropicCreditExhaustedError) {
          creditExhausted = true
          console.error('\n[usda-normalize] Anthropic credits exhausted — stopping early.')
          return
        }
        throw err
      }
      // If the LLM returned the unchanged raw string, treat it as a failure.
      const failed = newName === row.name

      let baseSlug = toSlug(newName)
      // Avoid colliding with a different food's slug; keep the row's own slug if it matches.
      if (allSlugs.has(baseSlug) && baseSlug !== row.slug) {
        baseSlug = `${baseSlug}-${row.id}`
      }
      allSlugs.add(baseSlug)

      results.push({ id: row.id, oldName: row.name, newName, newSlug: baseSlug, failed })
      done++
      progress(done, toProcess.length)
    })
  )
}
process.stdout.write('\n')

// ── Write updates to DB ───────────────────────────────────────────────────────

const successes = results.filter(r => !r.failed)
const failures  = results.filter(r => r.failed)

if (successes.length > 0) {
  console.log(`\nWriting ${successes.length.toLocaleString()} updates…`)
  let written = 0
  for (const batch of chunk(successes, 20)) {
    await Promise.all(
      batch.map(r =>
        db
          .update(foods)
          .set({ name: r.newName, slug: r.newSlug, dateUpdated: new Date() })
          .where(eq(foods.id, r.id))
      )
    )
    written += batch.length
    progress(written, successes.length)
  }
  process.stdout.write('\n')
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────')
console.log(`  Normalized:  ${successes.length.toLocaleString()}`)
console.log(`  Skipped:     ${alreadyNormalized.toLocaleString()} (already normalized)`)
console.log(`  LLM failed:  ${failures.length.toLocaleString()}`)
if (failures.length > 0) {
  console.log('\n  Failed names (raw USDA description kept):')
  for (const f of failures) {
    console.log(`    [id=${f.id}] ${f.oldName}`)
  }
}
console.log('─────────────────────────────────────────')
console.log('Done.\n')

process.exit(0)
