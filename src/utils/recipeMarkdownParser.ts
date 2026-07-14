import pluralize from 'pluralize'
import { MASS_UNITS, VOLUME_UNITS } from '@/utils/unitConversion'

export interface ParsedIngredient {
  raw: string
  quantity: number | null
  unit: string | null
  foodName: string | null
}

export interface ParsedRecipe {
  title: string
  meal: string | null
  serves: number | null
  prepTime: number | null
  cookTime: number | null
  description: string
  ingredients: ParsedIngredient[]
  steps: string[]
  // Attribution — populated only for URL Recipe Import; absent for markdown.
  sourceUrl?: string | null
  sourceName?: string | null
}

const KNOWN_UNITS = new Set([...MASS_UNITS, ...VOLUME_UNITS])

// Unit vocabulary for Recipe Import parsing (see ADR-0024). A leading token is treated as a
// unit only when it normalises (case, plural, common alias/abbreviation) to one of these
// canonical units; anything else is folded back into the food name. Deliberately narrow —
// Standard Units plus the Custom Units the app already knows — because an unrecognised
// count-unit (clove, sprig, …) has no correct calorie path anyway, and the Recipe Import
// Preview's editable unit is the backstop for those.
const UNIT_ALIASES: Record<string, string> = {
  // mass
  gram: 'g', g: 'g',
  kilogram: 'kg', kg: 'kg',
  milligram: 'mg', mg: 'mg',
  ounce: 'oz', oz: 'oz',
  pound: 'lb', lb: 'lb', lbs: 'lb',
  // volume
  milliliter: 'ml', millilitre: 'ml', ml: 'ml',
  liter: 'l', litre: 'l', l: 'l',
  cup: 'cup',
  tablespoon: 'Tbs', tbsp: 'Tbs', tbs: 'Tbs',
  teaspoon: 'tsp', tsp: 'tsp',
  'fluid-ounce': 'fl-oz', 'fl-oz': 'fl-oz', floz: 'fl-oz', fluidounce: 'fl-oz',
  // custom (see CUSTOM_UNITS in unitConversion)
  slice: 'slice', piece: 'piece', serving: 'serving', portion: 'portion',
  loaf: 'loaf', can: 'can', bottle: 'bottle', package: 'package', pkg: 'package',
}

// Unicode vulgar fractions → decimal value.
const VULGAR_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}
const VULGAR_CLASS = '¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞'

// Leading quantity: mixed number ("1 1/2"), fraction ("1/2"), decimal-with-vulgar ("1½"),
// lone vulgar ("½"), or plain decimal/whole ("1", "1.5", "1,5"). Ordered so the richer forms
// win before the plain-decimal fallback. Ranges ("1-2") are intentionally out of scope.
const QUANTITY_PATTERN = new RegExp(
  '^(?:' +
    '(\\d+)\\s+(\\d+)\\/(\\d+)' +                    // 1-3: mixed  "1 1/2"
    '|(\\d+)\\/(\\d+)' +                             // 4-5: fraction "1/2"
    `|(\\d+(?:[.,]\\d+)?)\\s*([${VULGAR_CLASS}])` +  // 6-7: "1½" / "1 ½"
    `|([${VULGAR_CLASS}])` +                         // 8:   lone "½"
    '|(\\d+(?:[.,]\\d+)?)' +                         // 9:   decimal / whole
  ')'
)

const toDecimal = (s: string) => parseFloat(s.replace(',', '.'))

// Consume a leading quantity from `text`, returning its numeric value and the remaining text,
// or null when the text does not begin with a recognised quantity.
function parseLeadingQuantity(text: string): { value: number; rest: string } | null {
  const m = text.match(QUANTITY_PATTERN)
  if (!m) return null

  let value: number
  if (m[1] !== undefined) {
    const denom = Number(m[3])
    value = denom === 0 ? NaN : Number(m[1]) + Number(m[2]) / denom
  } else if (m[4] !== undefined) {
    const denom = Number(m[5])
    value = denom === 0 ? NaN : Number(m[4]) / denom
  } else if (m[6] !== undefined) {
    value = toDecimal(m[6]) + VULGAR_FRACTIONS[m[7]]
  } else if (m[8] !== undefined) {
    value = VULGAR_FRACTIONS[m[8]]
  } else {
    value = toDecimal(m[9])
  }

  if (isNaN(value)) return null
  return { value, rest: text.slice(m[0].length) }
}

// Normalise a candidate unit token (case / plural / common alias) to a canonical unit, or null
// when it is not a recognised unit — in which case it belongs to the food name (see ADR-0024).
function normalizeUnitToken(token: string): string | null {
  const lower = token.toLowerCase()
  return UNIT_ALIASES[lower] ?? UNIT_ALIASES[pluralize.singular(lower)] ?? null
}

export function parseIngredientLine(raw: string): ParsedIngredient {
  const trimmed = raw.trim()
  const body = trimmed.replace(/^[-*]\s*/, '') // strip a leading markdown list marker

  const q = parseLeadingQuantity(body)
  // No leading quantity: quantity-less lines (e.g. "Salt to taste") are out of scope for now.
  if (!q) return { raw: trimmed, quantity: null, unit: null, foodName: null }

  const remainder = q.rest.trim()
  const spaceIdx = remainder.search(/\s/)
  const firstToken = spaceIdx === -1 ? remainder : remainder.slice(0, spaceIdx)
  const afterToken = spaceIdx === -1 ? '' : remainder.slice(spaceIdx + 1).trim()

  const unit = firstToken ? normalizeUnitToken(firstToken) : null
  // Strip the leading token off the food name only when it is genuinely a unit; otherwise an
  // adjective like "large" in "2 large eggs" stays part of the food name (see ADR-0024).
  const foodName = unit ? afterToken || null : remainder || null

  return { raw: trimmed, quantity: q.value, unit, foodName }
}

export function parseRecipeMarkdown(markdown: string): ParsedRecipe {
  const lines = markdown.split('\n')

  let title = ''
  let meal: string | null = null
  let serves: number | null = null
  let prepTime: number | null = null
  let cookTime: number | null = null
  let description = ''
  const ingredients: ParsedIngredient[] = []
  const steps: string[] = []

  type Section = 'pre-title' | 'metadata' | 'description' | 'ingredients' | 'steps'
  let section: Section = 'pre-title'

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('# ') && section === 'pre-title') {
      title = trimmed.slice(2).trim()
      section = 'metadata'
      continue
    }

    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim().toLowerCase()
      if (heading === 'description') section = 'description'
      else if (heading === 'ingredients') section = 'ingredients'
      else if (heading === 'steps') section = 'steps'
      continue
    }

    if (!trimmed) continue

    switch (section) {
      case 'metadata': {
        const kv = trimmed.match(/^([a-zA-Z]+)\s*:\s*(.+)$/)
        if (kv) {
          const key = kv[1].toLowerCase()
          const value = kv[2].trim()
          if (key === 'meal') meal = value
          else if (key === 'serves') serves = parseInt(value, 10) || null
          else if (key === 'preptime') prepTime = parseInt(value, 10) || null
          else if (key === 'cooktime') cookTime = parseInt(value, 10) || null
        }
        break
      }
      case 'description':
        description += (description ? '\n' : '') + trimmed
        break
      case 'ingredients':
        if (trimmed.startsWith('-')) {
          ingredients.push(parseIngredientLine(trimmed))
        }
        break
      case 'steps': {
        const stepMatch = trimmed.match(/^\d+\.\s+(.+)$/)
        if (stepMatch) steps.push(stepMatch[1].trim())
        break
      }
    }
  }

  return { title, meal, serves, prepTime, cookTime, description, ingredients, steps }
}

export function isKnownUnit(unit: string): boolean {
  return KNOWN_UNITS.has(unit as typeof MASS_UNITS[number] | typeof VOLUME_UNITS[number])
}
