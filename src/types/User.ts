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

// Upper bound shared by every goal field. Macros are stored as numeric(10,2) whose ceiling is
// 99,999,999.99; calories are a (smaller-range) integer, so this cap is safe for both columns.
export const NUTRITION_GOAL_MAX = 99_999_999.99

// Validate a single non-null goal value against what its destination column can store, so a value
// that would silently round or overflow on write is rejected at the boundary instead. Calories are
// whole numbers (integer column); macros allow up to 2 decimal places (numeric scale 2).
export function isValidGoalValue(field: keyof NutritionGoal, value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > NUTRITION_GOAL_MAX) return false
  if (field === 'calories') return Number.isInteger(value)
  return Number(value.toFixed(2)) === value
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
