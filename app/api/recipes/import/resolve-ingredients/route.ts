import { NextResponse } from 'next/server'
import { getFoodsByNames } from '@/lib/foods'
import { getSessionUser } from '@/lib/auth'
import type { ParsedIngredient } from '@/utils/recipeMarkdownParser'
import type { ResolvedIngredient } from '@/types/RecipeImport'

export type { ResolvedIngredient }

const MAX_INGREDIENTS = 50

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { ingredients: ParsedIngredient[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { ingredients } = body

  if (!Array.isArray(ingredients)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  if (ingredients.length > MAX_INGREDIENTS) {
    return NextResponse.json({ error: `Too many ingredients (max ${MAX_INGREDIENTS})` }, { status: 400 })
  }

  const malformed = ingredients.some((ing) => ing === null || typeof ing !== 'object' || typeof ing.raw !== 'string')
  if (malformed) {
    return NextResponse.json({ error: 'Invalid ingredient shape' }, { status: 400 })
  }

  // Build search terms: full phrase + meaningful individual words (>2 chars, no stop words)
  // so "white vinegar" also searches "vinegar" and can surface "Distilled Vinegar"
  const STOP_WORDS = new Set(['and', 'or', 'the', 'of', 'a', 'an', 'with', 'in', 'on', 'for'])
  const uniqueNames = [...new Set(ingredients.filter((i) => i.foodName).map((i) => i.foodName!))]
  const searchTerms = new Set(uniqueNames)
  for (const name of uniqueNames) {
    for (const word of name.split(/\s+/)) {
      if (word.length > 2 && !STOP_WORDS.has(word.toLowerCase())) {
        searchTerms.add(word)
      }
    }
  }
  const allFoods = await getFoodsByNames([...searchTerms])

  const results: ResolvedIngredient[] = ingredients.map((ing): ResolvedIngredient => {
    const base = { raw: ing.raw, parsed: { quantity: ing.quantity, unit: ing.unit, foodName: ing.foodName } }

    if (!ing.foodName) {
      return { ...base, status: 'unresolved' }
    }

    const nameLower = ing.foodName.toLowerCase()
    const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))

    // Phrase match first; fall back to word matching so "white vinegar" finds "Distilled Vinegar"
    const phraseMatches = allFoods.filter((f) => f.name.toLowerCase().includes(nameLower))
    const wordMatches =
      phraseMatches.length > 0
        ? phraseMatches
        : allFoods.filter((f) => {
            const fLower = f.name.toLowerCase()
            return nameWords.some((w) => fLower.includes(w))
          })

    const matches = wordMatches.slice().sort((a, b) => {
      const aL = a.name.toLowerCase()
      const bL = b.name.toLowerCase()
      const tier = (n: string) => (n === nameLower ? 0 : n.startsWith(nameLower) ? 1 : 2)
      return tier(aL) - tier(bL) || aL.localeCompare(bL)
    })

    const exact = matches.find((f) => f.name.toLowerCase() === nameLower)
    if (exact) return { ...base, status: 'matched', food: exact }

    const candidates = matches.slice(0, 3)
    if (candidates.length > 0) return { ...base, status: 'candidates', candidates }

    return { ...base, status: 'unresolved' }
  })

  return NextResponse.json({ results })
}
