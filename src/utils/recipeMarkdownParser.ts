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
}

const KNOWN_UNITS = new Set([...MASS_UNITS, ...VOLUME_UNITS])

// Matches: optional "- " then quantity (may be attached to unit, e.g. "500g"), unit, food name
// Examples: "500g chicken breast", "2 cup yogurt", "1 tsp cumin", "2.5 oz butter"
const INGREDIENT_PATTERN = /^-?\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z][a-zA-Z-]*)\s+(.+)$/

export function parseIngredientLine(raw: string): ParsedIngredient {
  const trimmed = raw.trim()
  const match = trimmed.match(INGREDIENT_PATTERN)
  if (!match) return { raw: trimmed, quantity: null, unit: null, foodName: null }

  const quantity = parseFloat(match[1].replace(',', '.'))
  const unit = match[2]
  const foodName = match[3].trim()

  if (isNaN(quantity)) return { raw: trimmed, quantity: null, unit: null, foodName: null }

  return { raw: trimmed, quantity, unit, foodName }
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
