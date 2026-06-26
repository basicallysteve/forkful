#!/usr/bin/env bun
/**
 * Backfill density on USDA foods by fetching live portion data from the USDA API.
 *
 * The bulk CSV seed did not derive density from portion data. This script fetches
 * each USDA food's full detail from FoodData Central (which includes volume portions)
 * and runs mapPortionsToData to derive density. Safe to interrupt and re-run —
 * already-updated foods are skipped.
 *
 * Usage:
 *   bun --env-file .env.production scripts/backfill-usda-density.ts
 *   bun --env-file .env.production scripts/backfill-usda-density.ts --dry-run
 *   bun --env-file .env.production scripts/backfill-usda-density.ts --limit 50
 *
 * Rate: 1 request/second (3 600/hour — matches USDA API key limit).
 * Expected runtime for ~8 000 foods: ~2.5 hours.
 */

import { parseArgs } from 'node:util'
import { isNull, eq, and, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import { fetchFoodDetail, mapPortionsToData } from '@/lib/usda'

// ── Args ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
  },
})

const dryRun = args['dry-run']
const limit = args.limit ? parseInt(args.limit, 10) : Infinity

const DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Query targets ─────────────────────────────────────────────────────────────

console.log('\nQuerying USDA foods without density…')

const targets = await db
  .select({ id: foods.id, name: foods.name, externalId: foods.externalId })
  .from(foods)
  .where(
    and(
      isNull(foods.dateDeleted),
      isNull(foods.density),
      isNotNull(foods.externalId),
    )
  )
  .then(rows => rows.filter(r => r.externalId != null))

const toProcess = isFinite(limit) ? targets.slice(0, limit) : targets
console.log(`  ${targets.length} total USDA foods need density`)
if (isFinite(limit)) console.log(`  Processing first ${toProcess.length} (--limit ${limit})`)
console.log(dryRun ? '  Dry run — no DB writes.\n' : '')

// ── Process ───────────────────────────────────────────────────────────────────

let updated = 0
let noPortions = 0
let noDensity = 0
let errors = 0

const startTime = Date.now()

for (let i = 0; i < toProcess.length; i++) {
  const row = toProcess[i]
  const fdcId = parseInt(row.externalId!, 10)

  // Progress line
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const eta = i > 0 ? Math.round(((Date.now() - startTime) / i) * (toProcess.length - i) / 1000) : '?'
  process.stdout.write(
    `\r  [${i + 1}/${toProcess.length}] elapsed=${elapsed}s eta=${eta}s  updated=${updated}  no-data=${noPortions + noDensity}  errors=${errors}  `
  )

  let detail
  try {
    detail = await fetchFoodDetail(fdcId)
  } catch {
    errors++
    await sleep(DELAY_MS)
    continue
  }

  if (!detail || !detail.foodPortions || detail.foodPortions.length === 0) {
    noPortions++
    await sleep(DELAY_MS)
    continue
  }

  const { density } = mapPortionsToData(detail.foodPortions)

  if (density == null || density <= 0) {
    noDensity++
    await sleep(DELAY_MS)
    continue
  }

  if (!dryRun) {
    await db.update(foods)
      .set({ density: String(density), dateUpdated: new Date() })
      .where(eq(foods.id, row.id))
  }

  updated++
  await sleep(DELAY_MS)
}

// ── Summary ───────────────────────────────────────────────────────────────────

const totalSeconds = Math.round((Date.now() - startTime) / 1000)
const mins = Math.floor(totalSeconds / 60)
const secs = totalSeconds % 60

process.stdout.write('\n')
console.log('\n─────────────────────────────')
console.log(`  Processed: ${toProcess.length}`)
console.log(dryRun ? `  Would update: ${updated}` : `  Updated:      ${updated}`)
console.log(`  No portions:  ${noPortions}`)
console.log(`  No density:   ${noDensity}  (portions exist but none are volume)`)
console.log(`  Errors:       ${errors}`)
console.log(`  Time:         ${mins}m ${secs}s`)
console.log('─────────────────────────────')
console.log('Done.\n')

process.exit(0)
