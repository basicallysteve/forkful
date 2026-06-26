#!/usr/bin/env bun
/**
 * Seed USDA Branded Foods from FDC Full Download CSV files into the products table.
 *
 * Usage:
 *   bun --env-file .env.local scripts/seed-usda-branded.ts --dir ./data/usda
 *
 * Expects the FDC Full Download CSV files in --dir:
 *   food.csv, food_nutrient.csv, food_portion.csv, measure_unit.csv, branded_food.csv
 *
 * Only rows whose branded_food_category matches ALLOWED_CATEGORY_SUBSTRINGS are imported.
 * Products are inserted with parentFoodId = null — run link-product-foods.ts afterward.
 *
 * Re-runnable: existing products (matched by externalId / fdcId) are updated in place.
 */

import { parseArgs } from 'node:util'
import { readFileSync, existsSync, createReadStream } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
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

// ── Category allowlist ────────────────────────────────────────────────────────
// A branded product is imported only when its branded_food_category contains at
// least one of these substrings (case-insensitive). Edit freely.

const ALLOWED_CATEGORY_SUBSTRINGS = [
  // Meat & poultry
  'poultry', 'chicken', 'turkey', 'duck',
  'beef', 'pork', 'lamb', 'veal', 'game', 'bison',
  'sausage', 'luncheon', 'deli', 'hot dog', 'bacon', 'ham',
  // Seafood
  'seafood', 'fish', 'shellfish', 'shrimp', 'salmon', 'tuna', 'crab', 'lobster',
  // Dairy & eggs
  'dairy', 'cheese', 'milk', 'butter', 'cream', 'yogurt', 'egg',
  // Produce
  'vegetable', 'produce', 'fruit', 'juice',
  // Grains & baked
  'bread', 'baked', 'grain', 'pasta', 'cereal', 'rice', 'flour', 'tortilla',
  // Nuts, seeds, legumes
  'nut', 'seed', 'legume', 'bean', 'lentil', 'tofu', 'soy',
  // Fats & condiments
  'fat', 'oil', 'dressing', 'sauce', 'soup', 'gravy', 'condiment',
  'spice', 'herb', 'seasoning', 'vinegar', 'mustard', 'ketchup', 'mayo',
  // Snacks & sweets
  'snack', 'chip', 'cracker', 'pretzel', 'popcorn',
  'sweet', 'candy', 'chocolate', 'dessert', 'cookie', 'cake', 'ice cream',
  // Frozen & prepared
  'frozen', 'meal', 'entree', 'pizza', 'dinner', 'breakfast',
  // Beverages
  'beverage', 'drink', 'water', 'coffee', 'tea', 'soda', 'smoothie',
]

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

// ── Volume unit → ml factors (for density derivation) ────────────────────────

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  cup: 236.588, cups: 236.588,
  tbsp: 14.787, tbs: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  'fl oz': 29.574, 'fl-oz': 29.574, 'fluid ounce': 29.574, 'fluid ounces': 29.574,
}

// ── Unit normalisation ────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  cup: 'cup', cups: 'cup',
  tbsp: 'Tbs', tbs: 'Tbs', tablespoon: 'Tbs', tablespoons: 'Tbs',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  'fl oz': 'fl-oz', 'fl-oz': 'fl-oz',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', pound: 'lb', pounds: 'lb',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
}

function normaliseUnit(raw: string | undefined): string | null {
  if (!raw) return null
  return UNIT_ALIASES[raw.toLowerCase().trim()] ?? null
}

// ── Category check ────────────────────────────────────────────────────────────

function isAllowedCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return ALLOWED_CATEGORY_SUBSTRINGS.some(s => lower.includes(s))
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: { dir: { type: 'string' } },
})

if (!args.dir) {
  console.error('Usage: bun --env-file .env.local scripts/seed-usda-branded.ts --dir ./data/usda')
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

  const rawServingSize = parseFloat(row.serving_size)
  const servingSize = isNaN(rawServingSize) || rawServingSize <= 0 ? 100 : rawServingSize
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
  const mlPerUnit = VOLUME_TO_ML[unitLower]
  if (mlPerUnit !== undefined && !densityByFood.has(r.fdc_id)) {
    const mlTotal = mlPerUnit * amount
    if (mlTotal > 0) {
      densityByFood.set(r.fdc_id, Math.round((gramWeight / mlTotal) * 10000) / 10000)
    }
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

for await (const row of streamCSVRows(join(dir, 'food_nutrient.csv'))) {
  totalNutrientRows++
  if (totalNutrientRows % 500000 === 0) {
    process.stdout.write(`\r  scanned ${totalNutrientRows.toLocaleString()} rows, kept ${keptNutrientRows.toLocaleString()}…`)
  }
  if (!targetBranded.has(row.fdc_id)) continue
  if (!wantedNids.has(row.nutrient_id)) continue
  const amount = parseFloat(row.amount)
  if (isNaN(amount)) continue
  keptNutrientRows++
  if (!nutrientByFood.has(row.fdc_id)) nutrientByFood.set(row.fdc_id, new Map())
  nutrientByFood.get(row.fdc_id)!.set(row.nutrient_id, amount)
}
process.stdout.write('\n')
console.log(`  ${totalNutrientRows.toLocaleString()} rows scanned, ${keptNutrientRows.toLocaleString()} kept`)

// ── Step 6: Load existing products from DB ────────────────────────────────────

console.log('\nQuerying existing products in database…')
const allExistingRows = await db
  .select({ id: products.id, externalId: products.externalId, dateDeleted: products.dateDeleted, slug: products.slug })
  .from(products)

const existingByExternalId = new Map(
  allExistingRows
    .filter(r => r.externalId)
    .map(r => [r.externalId!, { id: r.id, isDeleted: r.dateDeleted !== null }])
)
const takenSlugs = new Set(allExistingRows.map(r => r.slug).filter(Boolean) as string[])

console.log(`  ${allExistingRows.length.toLocaleString()} products already in DB`)
console.log(`  ${existingByExternalId.size.toLocaleString()} have externalId`)

// ── Step 7: Build insert / update lists ──────────────────────────────────────

type ProductValues = typeof products.$inferInsert

function buildValues(fdcId: string, meta: BrandedMeta): ProductValues {
  const nids = nutrientByFood.get(fdcId)
  const get = (id: string) => nids?.get(id) ?? 0

  const rawName = descriptions.get(fdcId) ?? `USDA Branded Food ${fdcId}`
  const name = rawName.length > 255 ? rawName.slice(0, 252) + '…' : rawName
  const portions = portionsByFood.get(fdcId) ?? []

  // Scale macros from per-100g to per serving when the serving unit is grams
  const isGramBased = /^g$/i.test(meta.servingUnit)
  const scale = isGramBased ? meta.servingSize / 100 : 1

  // slug: leave room for -fdcId suffix (fdcIds up to 8 digits + hyphen = 9 chars)
  const baseSlug = toSlug(name).slice(0, 245)
  const slug = takenSlugs.has(baseSlug) ? `${baseSlug}-${fdcId}` : baseSlug
  takenSlugs.add(slug)

  // Clamp all numeric fields to their DB column limits.
  // Bad data in the CSV (e.g. absurd bulk serving sizes) is safer to cap than crash.
  const mac = (v: number) => String(Math.min(Math.round(v * 100) / 100, 99999999.99))  // numeric(10,2)
  const sod = (v: number) => String(Math.min(Math.round(v * 10)  / 10,  999999999.9))  // numeric(10,1)
  const srv = (v: number) => String(Math.min(Math.round(v * 100) / 100, 99999999.99))  // numeric(10,2)

  const density = densityByFood.get(fdcId)

  return {
    name,
    slug,
    barcode: meta.barcode ? meta.barcode.slice(0, 50) : null,
    externalId: fdcId,
    parentFoodId: null,
    calories: Math.min(Math.round(get(NID.energy) * scale), 2147483647),
    protein: mac(get(NID.protein) * scale),
    carbs:   mac(get(NID.carbs)   * scale),
    fat:     mac(get(NID.fat)      * scale),
    fiber:   mac(get(NID.fiber)    * scale),
    saturatedFat: get(NID.satFat) ? mac(get(NID.satFat) * scale) : null,
    sugar:   get(NID.sugar)  ? mac(get(NID.sugar)  * scale) : null,
    sodium:  get(NID.sodium) ? sod(get(NID.sodium) * scale) : null,
    servingSize: srv(meta.servingSize),
    servingUnit: meta.servingUnit.slice(0, 50),
    density: density != null ? String(density) : null,
    measurements: portions.length
      ? [{ unit: meta.servingUnit }, ...portions]
      : [{ unit: meta.servingUnit }],
    source: 'usda_branded',
  }
}

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
    toInsert.push(buildValues(fdcId, meta))
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
console.log(`  Category skip: ${skippedCategory.toLocaleString()}`)
console.log('─────────────────────────────────────────')
console.log('Done. Run link-product-foods.ts to assign parent Foods.\n')

process.exit(0)
