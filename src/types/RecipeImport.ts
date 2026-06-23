import type { Food } from '@/types/Food'
import type { ParsedIngredient } from '@/utils/recipeMarkdownParser'

export interface ResolvedIngredient {
  raw: string
  parsed: Pick<ParsedIngredient, 'quantity' | 'unit' | 'foodName'>
  status: 'matched' | 'candidates' | 'unresolved'
  food?: Food
  candidates?: Food[]
}
