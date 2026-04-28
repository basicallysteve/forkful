export type User = {
  id: string
  username: string
  email: string
  password?: string
  cuisinePreferences: string[] | null
  dietaryRestrictions: string[] | null
  dateAdded: Date
  dateDeleted: Date | null
}
