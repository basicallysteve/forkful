#!/usr/bin/env bun
/**
 * Seed Foundation and SR Legacy foods from USDA FoodData Central bulk CSV files.
 *
 * Usage:
 *   bun --env-file .env scripts/seed-usda.ts --dir ./data/usda
 *
 * Expects the FDC Full Download CSV files in --dir (food.csv, food_nutrient.csv, etc.)
 * Only "Foundation Food" and "SR Legacy Food" rows are imported — Branded is skipped.
 *
 * Re-runnable: existing USDA foods (matched by externalId / fdcId) are updated in place.
 *
 * Note: food.csv (219 MB) and food_nutrient.csv (1.7 GB) are streamed line-by-line to
 * avoid loading multi-gigabyte files into memory.
 */

import { parseArgs } from 'node:util'
import { readFileSync, existsSync, createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { foods } from '@/db/schema'
import type { Measurement } from '@/types/Food'
import { toSlug } from '@/utils/slug'

// ── Nutrient IDs (FDC standard) ───────────────────────────────────────────────

const NID = {
  energy:  '1008', // kcal
  protein: '1003', // g
  carbs:   '1005', // g
  fat:     '1004', // g
  fiber:   '1079', // g
  satFat:  '1258', // g
  sugar:   '2000', // g
  sodium:  '1093', // mg
} as const

const VALID_DATA_TYPES = new Set(['foundation_food', 'sr_legacy_food'])
const INSERT_CHUNK = 200
const UPDATE_CONCURRENCY = 20

// ── CSV helpers ───────────────────────────────────────────────────────────────

/** Parse a single CSV line into fields, handling RFC-4180 quoting. */
function parseFields(line: string): string[] {
  const fields: string[] = []
  let i = 0

  while (i < line.length) {
    if (line[i] === '"') {
      let val = ''
      i++ // skip opening "
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          val += '"'; i += 2
        } else if (line[i] === '"') {
          i++; break
        } else {
          val += line[i++]
        }
      }
      fields.push(val)
      if (i < line.length && line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { fields.push(line.slice(i)); break }
      fields.push(line.slice(i, end))
      i = end + 1
    }
  }

  if (line.endsWith(',')) fields.push('')
  return fields
}

/**
 * Parse a small CSV file fully into memory (suitable for files < ~50 MB).
 * For large files use streamCSVRows instead.
 */
function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split('\n')
  if (lines.length === 0) return []

  const headers = parseFields(lines[0].replace(/\r$/, ''))
  const result: Record<string, string>[] = []

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r].replace(/\r$/, '')
    if (!line.trim()) continue
    const fields = parseFields(line)
    const row: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = fields[c] ?? ''
    }
    result.push(row)
  }
  return result
}

/**
 * Stream a large CSV file line-by-line using readline.
 * Yields each data row as a Record after reading the header.
 * Note: assumes no embedded newlines inside quoted fields (safe for FDC data).
 */
async function* streamCSVRows(filePath: string): AsyncGenerator<Record<string, string>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })

  let headers: string[] | null = null

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim()) continue

    if (headers === null) {
      headers = parseFields(line)
      continue
    }

    const fields = parseFields(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] ?? ''
    }
    yield row
  }
}

// ── Title-case helper ─────────────────────────────────────────────────────────

const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'as', 'vs', 'via',
])

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w+/g, (word, offset: number) =>
    offset === 0 || !LOWERCASE_WORDS.has(word)
      ? word[0].toUpperCase() + word.slice(1)
      : word
  )
}

// ── Batch / concurrency helpers ───────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function runConcurrently<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = []
  for (const batch of chunk(tasks, concurrency)) {
    results.push(...(await Promise.all(batch.map(t => t()))))
  }
  return results
}

function progress(label: string, done: number, total: number) {
  const pct = Math.round((done / total) * 100)
  process.stdout.write(`\r  ${label}: ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)  `)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: { dir: { type: 'string' } },
})

if (!args.dir) {
  console.error('Usage: bun --env-file .env.local run scripts/seed-usda.ts --dir ./data/usda')
  process.exit(1)
}

const dir = resolve(args.dir)
const REQUIRED_FILES = ['food.csv', 'food_nutrient.csv', 'nutrient.csv', 'food_portion.csv', 'measure_unit.csv']
for (const f of REQUIRED_FILES) {
  if (!existsSync(join(dir, f))) {
    console.error(`Missing required file: ${join(dir, f)}`)
    process.exit(1)
  }
}

// ── Step 1: Read small reference files into memory ────────────────────────────

console.log('\nReading reference files…')
const measureUnits = new Map(
  parseCSV(readFileSync(join(dir, 'measure_unit.csv'), 'utf-8')).map(r => [r.id, r.name])
)
const portionRows = parseCSV(readFileSync(join(dir, 'food_portion.csv'), 'utf-8'))
console.log(`  measure_unit.csv: ${measureUnits.size} units`)
console.log(`  food_portion.csv: ${portionRows.length.toLocaleString()} rows`)

// ── Step 2: Stream food.csv to collect Foundation + SR Legacy fdcIds ──────────

console.log('\nStreaming food.csv to identify Foundation / SR Legacy foods…')
// Map: fdcId → description
const targetFoods = new Map<string, string>()
let totalFoodRows = 0

for await (const row of streamCSVRows(join(dir, 'food.csv'))) {
  totalFoodRows++
  if (totalFoodRows % 50000 === 0) {
    process.stdout.write(`\r  scanned ${totalFoodRows.toLocaleString()} rows, found ${targetFoods.size.toLocaleString()} target foods…`)
  }
  if (VALID_DATA_TYPES.has(row.data_type)) {
    targetFoods.set(row.fdc_id, row.description)
  }
}
process.stdout.write('\n')
console.log(`  ${totalFoodRows.toLocaleString()} total rows scanned`)
console.log(`  ${targetFoods.size.toLocaleString()} Foundation / SR Legacy foods found`)
console.log(`  ${(totalFoodRows - targetFoods.size).toLocaleString()} rows skipped (other data types)`)

if (targetFoods.size === 0) {
  console.error('No target foods found — check that food.csv contains Foundation or SR Legacy rows.')
  process.exit(1)
}

// ── Step 3: Build portions map from food_portion.csv ─────────────────────────

console.log('\nBuilding portions map…')
// fdcId → Measurement[]
const portionsByFood = new Map<string, Measurement[]>()

for (const r of portionRows) {
  if (!targetFoods.has(r.fdc_id)) continue
  const amount = parseFloat(r.amount)
  const gramWeight = parseFloat(r.gram_weight)
  if (!amount || !gramWeight || isNaN(amount) || isNaN(gramWeight)) continue

  const unitName = measureUnits.get(r.measure_unit_id) ?? r.portion_description
  if (!unitName || unitName === 'undetermined' || unitName === '') continue

  const gramsPerUnit = gramWeight / amount
  const existing = portionsByFood.get(r.fdc_id) ?? []
  if (!existing.some(m => m.unit === unitName)) {
    existing.push({ unit: unitName, gramsPerUnit: Math.round(gramsPerUnit * 100) / 100 })
  }
  portionsByFood.set(r.fdc_id, existing)
}
console.log(`  ${portionsByFood.size.toLocaleString()} foods have portion data`)

// ── Step 4: Stream food_nutrient.csv — only collect rows for target foods ─────

console.log('\nStreaming food_nutrient.csv (1.7 GB — this takes a minute)…')
// fdcId → (nutrientId → amount)
const nutrientByFood = new Map<string, Map<string, number>>()
const wantedNids = new Set(Object.values(NID))
let totalNutrientRows = 0
let keptNutrientRows = 0

for await (const row of streamCSVRows(join(dir, 'food_nutrient.csv'))) {
  totalNutrientRows++
  if (totalNutrientRows % 500000 === 0) {
    process.stdout.write(`\r  scanned ${totalNutrientRows.toLocaleString()} rows, kept ${keptNutrientRows.toLocaleString()}…`)
  }

  // Skip rows not for our target foods or nutrients we don't need
  if (!targetFoods.has(row.fdc_id)) continue
  if (!wantedNids.has(row.nutrient_id)) continue

  const amount = parseFloat(row.amount)
  if (isNaN(amount)) continue

  keptNutrientRows++
  if (!nutrientByFood.has(row.fdc_id)) nutrientByFood.set(row.fdc_id, new Map())
  nutrientByFood.get(row.fdc_id)!.set(row.nutrient_id, amount)
}
process.stdout.write('\n')
console.log(`  ${totalNutrientRows.toLocaleString()} rows scanned, ${keptNutrientRows.toLocaleString()} kept`)

// ── Step 5: Load existing foods from DB ──────────────────────────────────────

console.log('\nQuerying existing foods in database…')
const allExistingRows = await db
  .select({ id: foods.id, externalId: foods.externalId, dateDeleted: foods.dateDeleted, slug: foods.slug, source: foods.source })
  .from(foods)

// externalId → { id, isDeleted }  (USDA foods only, for upsert matching)
const existingByExternalId = new Map(
  allExistingRows
    .filter(r => r.source === 'usda')
    .map(r => [r.externalId ?? '', { id: r.id, isDeleted: r.dateDeleted !== null }])
)
// All slugs currently in the DB — used to avoid collisions on insert
const takenSlugs = new Set(allExistingRows.map(r => r.slug).filter(Boolean) as string[])

console.log(`  ${allExistingRows.length.toLocaleString()} total foods in DB`)
console.log(`  ${existingByExternalId.size.toLocaleString()} existing USDA foods`)

// ── Step 6: Separate into inserts and updates ─────────────────────────────────

type FoodValues = typeof foods.$inferInsert

function buildValues(fdcId: string, description: string): FoodValues {
  const nids = nutrientByFood.get(fdcId)
  const get = (id: string) => nids?.get(id) ?? 0

  const name = toTitleCase(description)
  const portions = portionsByFood.get(fdcId) ?? []

  // Generate a unique slug — append fdcId if the base slug is already taken
  const baseSlug = toSlug(name)
  const slug = takenSlugs.has(baseSlug) ? `${baseSlug}-${fdcId}` : baseSlug
  takenSlugs.add(slug)

  return {
    name,
    slug,
    calories: Math.round(get(NID.energy)),
    protein: String(Math.round(get(NID.protein) * 100) / 100),
    carbs:   String(Math.round(get(NID.carbs)   * 100) / 100),
    fat:     String(Math.round(get(NID.fat)      * 100) / 100),
    fiber:   String(Math.round(get(NID.fiber)    * 100) / 100),
    saturatedFat: get(NID.satFat) ? String(Math.round(get(NID.satFat) * 100) / 100) : null,
    sugar:   get(NID.sugar)  ? String(Math.round(get(NID.sugar)  * 100) / 100) : null,
    sodium:  get(NID.sodium) ? String(Math.round(get(NID.sodium) * 10)  / 10)  : null,
    servingSize: '100',
    servingUnit: 'g',
    measurements: portions,
    externalId: fdcId,
    source: 'usda',
  }
}

const toInsert: FoodValues[] = []
const toUpdate: { id: number; values: Partial<FoodValues> }[] = []
let skipped = 0

for (const [fdcId, description] of targetFoods) {
  const existing = existingByExternalId.get(fdcId)
  if (existing) {
    if (existing.isDeleted) { skipped++; continue }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { slug: _slug, source: _src, ...updateFields } = buildValues(fdcId, description)
    toUpdate.push({ id: existing.id, values: updateFields })
  } else {
    toInsert.push(buildValues(fdcId, description))
  }
}

console.log(`\n  ${toInsert.length.toLocaleString()} to insert`)
console.log(`  ${toUpdate.length.toLocaleString()} to update`)
console.log(`  ${skipped} skipped (soft-deleted)`)

// ── Step 7: Batch insert ──────────────────────────────────────────────────────

let inserted = 0
if (toInsert.length > 0) {
  console.log('\nInserting…')
  for (const batch of chunk(toInsert, INSERT_CHUNK)) {
    await db.insert(foods).values(batch)
    inserted += batch.length
    progress('inserted', inserted, toInsert.length)
  }
  process.stdout.write('\n')
}

// ── Step 8: Batch update ──────────────────────────────────────────────────────

let updated = 0
if (toUpdate.length > 0) {
  console.log('\nUpdating…')
  const tasks = toUpdate.map(({ id, values }) => async () => {
    await db.update(foods).set({ ...values, dateUpdated: new Date() }).where(eq(foods.id, id))
    updated++
    if (updated % UPDATE_CONCURRENCY === 0) {
      progress('updated', updated, toUpdate.length)
    }
  })
  await runConcurrently(tasks, UPDATE_CONCURRENCY)
  progress('updated', updated, toUpdate.length)
  process.stdout.write('\n')
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────')
console.log(`  Inserted: ${inserted.toLocaleString()}`)
console.log(`  Updated:  ${updated.toLocaleString()}`)
console.log(`  Skipped:  ${skipped}`)
console.log('─────────────────────────────')
console.log('Done.\n')

process.exit(0)
