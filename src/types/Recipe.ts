import { type Ingredient } from "@/types/Ingredient"
import { type RecipeStep } from "@/types/RecipeStep"

export type Recipe = {
  id: number
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
  isPublic: boolean
  nutritionComplete: boolean
}
