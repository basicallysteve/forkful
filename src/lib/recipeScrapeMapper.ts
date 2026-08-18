import type { RecipeObject } from 'recipe-scrapers'
import type { ParsedRecipe, ParsedIngredient } from '@/utils/recipeMarkdownParser'
import { parseIngredientLine, normalizeUnitToken } from '@/utils/recipeMarkdownParser'

const MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'] as const

// parse-ingredient normalizes units to a canonical id (e.g. "tablespoon"); map those the app
// understands onto our canonical units through the shared alias table (see ADR-0024) so the URL
// and Markdown import paths agree on unit spelling. Unrecognised units fall through unchanged —
// the ingredient still resolves to a Food, it just won't calorie-calc until the user picks a
// known unit in the preview.
function normalizeUnit(unitId: string | null, unit: string | null): string | null {
  const raw = (unitId ?? unit ?? '').trim()
  if (!raw) return null
  return normalizeUnitToken(raw) ?? unit ?? unitId
}

// "4 servings" → 4, "Serves 6-8" → 6, "Makes a dozen" → null
function parseServes(yields: string | null | undefined): number | null {
  if (!yields) return null
  const match = yields.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

function pickMeal(category: string[] | null | undefined): string | null {
  if (!category) return null
  for (const cat of category) {
    const hit = MEAL_OPTIONS.find((m) => m.toLowerCase() === cat.toLowerCase().trim())
    if (hit) return hit
  }
  return null
}

/**
 * Maps the raw `recipe-scrapers` output into the canonical ParsedRecipe shape that the
 * shared Recipe Import Preview consumes — the same shape parseRecipeMarkdown produces.
 * `sourceUrl` is the URL the user supplied, used as the attribution fallback when the
 * scraper doesn't surface a canonical URL. Pure: no I/O, so it can be unit-tested
 * against fixture scraper output.
 */
export function mapScrapedRecipe(raw: RecipeObject, sourceUrl?: string): ParsedRecipe {
  const ingredients: ParsedIngredient[] = []
  for (const group of raw.ingredients ?? []) {
    for (const item of group.items ?? []) {
      const value = item.value?.trim()
      if (!value) continue
      const parsed = item.parsed
      if (parsed) {
        if (parsed.isGroupHeader) continue // "For the sauce" — a section label, not an ingredient
        ingredients.push({
          raw: value,
          quantity: parsed.quantity ?? null,
          unit: normalizeUnit(parsed.unitOfMeasureID, parsed.unitOfMeasure),
          foodName: parsed.description?.trim() || null,
        })
      } else {
        ingredients.push(parseIngredientLine(value))
      }
    }
  }

  const steps: string[] = []
  for (const group of raw.instructions ?? []) {
    for (const item of group.items ?? []) {
      const value = item.value?.trim()
      if (value) steps.push(value)
    }
  }

  return {
    title: raw.title ?? '',
    meal: pickMeal(raw.category),
    serves: parseServes(raw.yields),
    prepTime: raw.prepTime ?? null,
    cookTime: raw.cookTime ?? null,
    description: raw.description ?? '',
    ingredients,
    steps,
    sourceUrl: raw.canonicalUrl || sourceUrl || null,
    sourceName: raw.siteName || null,
  }
}
