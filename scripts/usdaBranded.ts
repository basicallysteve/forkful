/**
 * Pure helpers for scripts/seed-usda-branded.ts (category filter, unit
 * normalisation, density derivation, numeric clamping). No I/O, so they can be
 * unit-tested without a database or the FDC CSV files.
 */

// A branded product is imported only when its branded_food_category contains at
// least one of these substrings (case-insensitive). Edit freely.
export const ALLOWED_CATEGORY_SUBSTRINGS = [
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

export function isAllowedCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return ALLOWED_CATEGORY_SUBSTRINGS.some(s => lower.includes(s))
}

// Volume unit -> ml factors (for density derivation)
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  cup: 236.588, cups: 236.588,
  tbsp: 14.787, tbs: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  'fl oz': 29.574, 'fl-oz': 29.574, 'fluid ounce': 29.574, 'fluid ounces': 29.574,
}

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

/** Map a raw FDC unit name to the app's unit vocabulary, or null if not a standard unit. */
export function normaliseUnit(raw: string | undefined): string | null {
  if (!raw) return null
  return UNIT_ALIASES[raw.toLowerCase().trim()] ?? null
}

/**
 * Density (g/ml, 4 dp) from one portion row, or null when the unit is not a
 * volume unit or the inputs are unusable.
 */
export function deriveDensity(unitLower: string, amount: number, gramWeight: number): number | null {
  const mlPerUnit = VOLUME_TO_ML[unitLower]
  if (mlPerUnit === undefined) return null
  const mlTotal = mlPerUnit * amount
  if (!(mlTotal > 0) || !(gramWeight > 0)) return null
  return Math.round((gramWeight / mlTotal) * 10000) / 10000
}

// Clamp numeric fields to their DB column limits. Bad CSV data (e.g. absurd bulk
// serving sizes) is safer to cap than to crash the whole import.
const MAX_NUMERIC_10_2 = 99999999.99
const MAX_NUMERIC_10_1 = 999999999.9
const MAX_INT = 2147483647

/** numeric(10,2), returned as a string for Drizzle. */
export function clampMacro(v: number): string {
  return String(Math.min(Math.round(v * 100) / 100, MAX_NUMERIC_10_2))
}

/** numeric(10,1), returned as a string for Drizzle. */
export function clampSodium(v: number): string {
  return String(Math.min(Math.round(v * 10) / 10, MAX_NUMERIC_10_1))
}

/** numeric(10,2) serving size, returned as a string for Drizzle. */
export function clampServing(v: number): string {
  return clampMacro(v)
}

/** integer column. */
export function clampCalories(v: number): number {
  return Math.min(Math.round(v), MAX_INT)
}
