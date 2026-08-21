export type RecipeSuggestionFrequency = 'never' | 'weekly' | 'monthly'
export type PantryExpirationFrequency = 'never' | 'daily' | 'weekly'

// A User's daily Nutrition Goal (see CONTEXT.md). Manually set — never computed from biometrics.
// Each field is independently nullable; null means that field has no target.
export type NutritionGoal = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
}

export type User = {
  id?: string | number
  username: string
  email: string
  password?: string
  hasPassword: boolean
  cuisinePreferences: string[] | null
  dietaryRestrictions: string[] | null
  avatarUrl?: string | null
  marketingEmailOptIn: boolean
  recipeSuggestionFrequency: RecipeSuggestionFrequency
  pantryExpirationFrequency: PantryExpirationFrequency
  enableShoppingListPricingCollection: boolean
  nutritionGoal: NutritionGoal
  dateAdded: Date
  dateDeleted: Date | null
}
