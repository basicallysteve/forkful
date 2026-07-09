export type RecipeSuggestionFrequency = 'never' | 'weekly' | 'monthly'
export type PantryExpirationFrequency = 'never' | 'daily' | 'weekly'

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
  dateAdded: Date
  dateDeleted: Date | null
}
