import { type Ingredient } from "@/types/Ingredient"
import { type RecipeStep } from "@/types/RecipeStep"

export type CreateRecipeInput = Omit<Recipe, 'id' | 'shortId' | 'nutritionComplete'>

export type Recipe = {
  id: number
  shortId: string
  name: string
  meal?: "Lunch" | "Dinner" | "Breakfast" | "Snack" | "Dessert"
  description: string
  ingredients: Ingredient[]
  ingredientCount?: number
  steps?: RecipeStep[]
  prepTime?: number | null
  cookTime?: number | null
  totalTime?: number | null
  cuisineType?: string | null
  dietaryTags?: string[]
  date_added?: Date
  date_published?: Date | null
  userId?: number | null
  serves?: number | null
  sourceUrl?: string | null
  sourceName?: string | null
  isPublic: boolean
  nutritionComplete: boolean
  viewCount?: number
}
