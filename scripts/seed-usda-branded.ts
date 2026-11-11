#!/usr/bin/env bun
/**
 * Seed USDA Branded Foods from FDC Full Download CSV files into the products table.
 *
 * Usage:
 *   bun seed:usda-branded        # seeds the database in .env.local (dev)
 *   bun seed:usda-branded:prod   # deliberately seeds production (.env.production)
 *
 * Expects the FDC Full Download CSV files in --dir:
 *   food.csv, food_nutrient.csv, food_portion.csv, measure_unit.csv, branded_food.csv
 *
 * Only rows whose branded_food_category matches ALLOWED_CATEGORY_SUBSTRINGS (usdaBranded.ts) are imported.
 * Products are inserted with parentFoodId = null (see ADR 0027: linking is a separate pass).
 *
 * Re-runnable: existing products (matched by externalId / fdcId) are updated in place.
 */

import { parseArgs } from 'node:util'
import { assertSafeSeedTarget } from './seedGuard'
import { readFileSync, existsSync, createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import type { Measurement } from '@/types/Food'
import { toSlug } from '@/utils/slug'
import {
  isAllowedCategory, normaliseUnit, deriveDensity, clampMacro, clampSodium, clampServing, clampCalories,
  parseServingSize, servingScale, isCustomServingUnit, uniqueSlug, indexBrandedByExternalId, BRANDED_SOURCE,
} from './usdaBranded'

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

// ── Constants ─────────────────────────────────────────────────────────────────

const INSERT_CHUNK = 200
const UPDATE_CONCURRENCY = 20
const REQUIRED_FILES = [
  'food.csv', 'food_nutrient.csv', 'food_portion.csv',
  'measure_unit.csv', 'branded_food.csv',
]

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseFields(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let val = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { val += line[i++] }
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
    for (let c = 0; c < headers.length; c++) row[headers[c]] = fields[c] ?? ''
    result.push(row)
  }
  return result
}

async function* streamCSVRows(filePath: string): AsyncGenerator<Record<string, string>> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })
  let headers: string[] | null = null
  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim()) continue
    if (headers === null) { headers = parseFields(line); continue }
    const fields = parseFields(line)
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = fields[i] ?? ''
    yield row
  }
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

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

// Refuse to touch production unless explicitly allowed (see seedGuard.ts).
assertSafeSeedTarget(
  process.env,
  existsSync('.env.production') ? readFileSync('.env.production', 'utf-8') : null,
)

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: { dir: { type: 'string' } },
})

if (!args.dir) {
  console.error('Usage: bun seed:usda-branded -- --dir ./data/usda')
  process.exit(1)
}

const dir = resolve(args.dir)
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

// ── Step 2: Stream branded_food.csv to collect target products ────────────────

interface BrandedMeta {
  brandOwner: string
  barcode: string
  servingSize: number
  servingUnit: string
  category: string
}

console.log('\nStreaming branded_food.csv…')
const targetBranded = new Map<string, BrandedMeta>()
let totalBrandedRows = 0
let skippedCategory = 0

for await (const row of streamCSVRows(join(dir, 'branded_food.csv'))) {
  totalBrandedRows++
  if (totalBrandedRows % 100000 === 0) {
    process.stdout.write(`\r  scanned ${totalBrandedRows.toLocaleString()} rows, accepted ${targetBranded.size.toLocaleString()}…`)
  }

  const category = row.branded_food_category ?? ''
  if (!isAllowedCategory(category)) { skippedCategory++; continue }

  const servingSize = parseServingSize(row.serving_size)
  const rawUnit = row.serving_size_unit?.trim()
  const servingUnit = normaliseUnit(rawUnit) ?? rawUnit ?? 'g'

  targetBranded.set(row.fdc_id, {
    brandOwner: row.brand_owner ?? '',
    barcode: row.gtin_upc ?? '',
    servingSize,
    servingUnit,
    category,
  })
}
process.stdout.write('\n')
console.log(`  ${totalBrandedRows.toLocaleString()} total branded rows`)
console.log(`  ${targetBranded.size.toLocaleString()} accepted (category match)`)
console.log(`  ${skippedCategory.toLocaleString()} skipped (category filter)`)

if (targetBranded.size === 0) {
  console.error('No branded products passed the category filter — check ALLOWED_CATEGORY_SUBSTRINGS.')
  process.exit(1)
}

// ── Step 3: Stream food.csv to collect descriptions ───────────────────────────

console.log('\nStreaming food.csv for descriptions…')
const descriptions = new Map<string, string>()
let totalFoodRows = 0

for await (const row of streamCSVRows(join(dir, 'food.csv'))) {
  totalFoodRows++
  if (totalFoodRows % 50000 === 0) {
    process.stdout.write(`\r  scanned ${totalFoodRows.toLocaleString()} rows…`)
  }
  if (targetBranded.has(row.fdc_id)) {
    descriptions.set(row.fdc_id, row.description)
  }
}
process.stdout.write('\n')
console.log(`  ${descriptions.size.toLocaleString()} descriptions matched`)

// ── Step 4: Build portions and density maps ───────────────────────────────────

console.log('\nBuilding portions and density maps…')
const portionsByFood = new Map<string, Measurement[]>()
const densityByFood = new Map<string, number>()

for (const r of portionRows) {
  if (!targetBranded.has(r.fdc_id)) continue
  const amount = parseFloat(r.amount)
  const gramWeight = parseFloat(r.gram_weight)
  if (!amount || !gramWeight || isNaN(amount) || isNaN(gramWeight)) continue

  const unitName = measureUnits.get(r.measure_unit_id) ?? r.portion_description
  if (!unitName || unitName === 'undetermined' || unitName === '') continue

  // Derive density from the first volume portion found
  const unitLower = unitName.toLowerCase().trim()
  if (!densityByFood.has(r.fdc_id)) {
    const d = deriveDensity(unitLower, amount, gramWeight)
    if (d !== null) densityByFood.set(r.fdc_id, d)
  }

  // Only store non-standard units as Calibrated Custom Unit Measurements
  const isStandardUnit = normaliseUnit(unitName) !== null
  if (!isStandardUnit) {
    const gramsPerUnit = gramWeight / amount
    const existing = portionsByFood.get(r.fdc_id) ?? []
    if (!existing.some(m => m.unit === unitLower)) {
      existing.push({ unit: unitLower, gramsPerUnit: Math.round(gramsPerUnit * 100) / 100 })
    }
    portionsByFood.set(r.fdc_id, existing)
  }
}
console.log(`  ${portionsByFood.size.toLocaleString()} products have portion data`)
console.log(`  ${densityByFood.size.toLocaleString()} products have density`)

// ── Step 5: Stream food_nutrient.csv ─────────────────────────────────────────

console.log('\nStreaming food_nutrient.csv (this takes a while)…')
const nutrientByFood = new Map<string, Map<string, number>>()
const wantedNids = new Set<string>(Object.values(NID))
let totalNutrientRows = 0
let keptNutrientRows = 0
let skippedNonFinite = 0
let customUnitProducts = 0

for await (const row of streamCSVRows(join(dir, 'food_nutrient.csv'))) {
  totalNutrientRows++
  if (totalNutrientRows % 500000 === 0) {
    process.stdout.write(`\r  scanned ${totalNutrientRows.toLocaleString()} rows, kept ${keptNutrientRows.toLocaleString()}…`)
  }
  if (!targetBranded.has(row.fdc_id)) continue
  if (!wantedNids.has(row.nutrient_id)) continue
  const amount = parseFloat(row.amount)
  if (!Number.isFinite(amount)) { skippedNonFinite++; continue }
  keptNutrientRows++
  if (!nutrientByFood.has(row.fdc_id)) nutrientByFood.set(row.fdc_id, new Map())
  nutrientByFood.get(row.fdc_id)!.set(row.nutrient_id, amount)
}
process.stdout.write('\n')
console.log(`  ${totalNutrientRows.toLocaleString()} rows scanned, ${keptNutrientRows.toLocaleString()} kept`)

// ── Step 6: Load existing products from DB ────────────────────────────────────

console.log('\nQuerying existing products in database…')
const allExistingRows = await db
  .select({ id: products.id, externalId: products.externalId, source: products.source, dateDeleted: products.dateDeleted, slug: products.slug })
  .from(products)

// Only usda_branded rows are upsert targets; slugs are unique across ALL sources, so
// takenSlugs deliberately covers every row.
const existingByExternalId = indexBrandedByExternalId(allExistingRows)
const takenSlugs = new Set(allExistingRows.map(r => r.slug).filter(Boolean) as string[])

console.log(`  ${allExistingRows.length.toLocaleString()} products already in DB`)
console.log(`  ${existingByExternalId.size.toLocaleString()} are usda_branded with externalId`)

// ── Step 7: Build insert / update lists ──────────────────────────────────────

type ProductValues = typeof products.$inferInsert

function buildValues(fdcId: string, meta: BrandedMeta): ProductValues {
  const nids = nutrientByFood.get(fdcId)
  const get = (id: string) => nids?.get(id) ?? 0

  const rawName = descriptions.get(fdcId) ?? `USDA Branded Food ${fdcId}`
  const name = rawName.length > 255 ? rawName.slice(0, 252) + '…' : rawName
  const portions = portionsByFood.get(fdcId) ?? []

  // USDA values are per 100 g; products store them per serving (see servingScale)
  const density = densityByFood.get(fdcId)
  // Custom units (slice, piece, ...) get 0 nutrition until #156 lands.
  const scale = servingScale(meta.servingSize, meta.servingUnit, density)

  // slug: leave room for -fdcId suffix (fdcIds up to 8 digits + hyphen = 9 chars)
  const baseSlug = toSlug(name).slice(0, 245)
  const slug = uniqueSlug(baseSlug, fdcId, takenSlugs)
  // takenSlugs.add() is intentionally omitted here — caller reserves the slug only for inserts

  return {
    name,
    slug,
    barcode: meta.barcode ? meta.barcode.slice(0, 50) : null,
    externalId: fdcId,
    parentFoodId: null,
    calories: clampCalories(get(NID.energy) * scale),
    protein: clampMacro(get(NID.protein) * scale),
    carbs:   clampMacro(get(NID.carbs)   * scale),
    fat:     clampMacro(get(NID.fat)      * scale),
    fiber:   clampMacro(get(NID.fiber)    * scale),
    saturatedFat: get(NID.satFat) ? clampMacro(get(NID.satFat) * scale) : null,
    sugar:   get(NID.sugar)  ? clampMacro(get(NID.sugar)  * scale) : null,
    sodium:  get(NID.sodium) ? clampSodium(get(NID.sodium) * scale) : null,
    servingSize: clampServing(meta.servingSize),
    servingUnit: meta.servingUnit.slice(0, 50),
    density: density != null ? String(density) : null,
    measurements: portions.length
      ? [{ unit: meta.servingUnit }, ...portions]
      : [{ unit: meta.servingUnit }],
    source: BRANDED_SOURCE,
  }
}

for (const meta of targetBranded.values()) if (isCustomServingUnit(meta.servingUnit)) customUnitProducts++

const toInsert: ProductValues[] = []
const toUpdate: { id: number; values: Partial<ProductValues> }[] = []
let skippedDeleted = 0

for (const [fdcId, meta] of targetBranded) {
  const existing = existingByExternalId.get(fdcId)
  if (existing) {
    if (existing.isDeleted) { skippedDeleted++; continue }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { slug: _slug, source: _src, parentFoodId: _pid, ...updateFields } = buildValues(fdcId, meta)
    toUpdate.push({ id: existing.id, values: updateFields })
  } else {
    const values = buildValues(fdcId, meta)
    takenSlugs.add(values.slug!)
    toInsert.push(values)
  }
}

console.log(`\n  ${toInsert.length.toLocaleString()} to insert`)
console.log(`  ${toUpdate.length.toLocaleString()} to update`)
console.log(`  ${skippedDeleted} skipped (soft-deleted)`)

// ── Step 8: Batch insert ──────────────────────────────────────────────────────

let inserted = 0
if (toInsert.length > 0) {
  console.log('\nInserting…')
  for (const batch of chunk(toInsert, INSERT_CHUNK)) {
    await db.insert(products).values(batch)
    inserted += batch.length
    progress('inserted', inserted, toInsert.length)
  }
  process.stdout.write('\n')
}

// ── Step 9: Batch update ──────────────────────────────────────────────────────

let updated = 0
if (toUpdate.length > 0) {
  console.log('\nUpdating…')
  const tasks = toUpdate.map(({ id, values }) => async () => {
    await db.update(products).set({ ...values, dateUpdated: new Date() }).where(eq(products.id, id))
    updated++
    if (updated % UPDATE_CONCURRENCY === 0) progress('updated', updated, toUpdate.length)
  })
  await runConcurrently(tasks, UPDATE_CONCURRENCY)
  progress('updated', updated, toUpdate.length)
  process.stdout.write('\n')
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────')
console.log(`  Inserted:      ${inserted.toLocaleString()}`)
console.log(`  Updated:       ${updated.toLocaleString()}`)
console.log(`  Skipped:       ${skippedDeleted} (soft-deleted)`)
console.log(`  Custom-unit products stored with 0 nutrition (see #156): ${customUnitProducts.toLocaleString()}`)
console.log(`  Non-finite nutrient rows skipped: ${skippedNonFinite.toLocaleString()}`)
console.log(`  Category skip: ${skippedCategory.toLocaleString()}`)
console.log('─────────────────────────────────────────')
console.log('Done. Products are imported with no parent Food; linking is a separate pass.\n')

process.exit(0)
