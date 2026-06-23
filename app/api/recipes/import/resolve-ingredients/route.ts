import { NextResponse } from 'next/server'
import { getFoods } from '@/lib/foods'
import type { ParsedIngredient } from '@/utils/recipeMarkdownParser'
import type { ResolvedIngredient } from '@/types/RecipeImport'

export type { ResolvedIngredient }

export async function POST(request: Request) {
  const body: { ingredients: ParsedIngredient[] } = await request.json()
  const { ingredients } = body

  if (!Array.isArray(ingredients)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const malformed = ingredients.some((ing) => ing === null || typeof ing !== 'object' || typeof ing.raw !== 'string')
  if (malformed) {
    return NextResponse.json({ error: 'Invalid ingredient shape' }, { status: 400 })
  }

  const results: ResolvedIngredient[] = await Promise.all(
    ingredients.map(async (ing): Promise<ResolvedIngredient> => {
      const base = { raw: ing.raw, parsed: { quantity: ing.quantity, unit: ing.unit, foodName: ing.foodName } }

      if (!ing.foodName) {
        return { ...base, status: 'unresolved' }
      }

      // Try exact case-insensitive match first
      const exactMatches = await getFoods({ search: ing.foodName })
      const exact = exactMatches.find(
        (f) => f.name.toLowerCase() === ing.foodName!.toLowerCase()
      )

      if (exact) {
        return { ...base, status: 'matched', food: exact }
      }

      // Fall back to top 3 candidates from the search results
      const candidates = exactMatches.slice(0, 3)
      if (candidates.length > 0) {
        return { ...base, status: 'candidates', candidates }
      }

      return { ...base, status: 'unresolved' }
    })
  )

  return NextResponse.json({ results })
}
