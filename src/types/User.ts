export type User = {
  id?: string | number
  username: string
  email: string
  password?: string
  hasPassword: boolean
  cuisinePreferences: string[] | null
  dietaryRestrictions: string[] | null
  avatarUrl?: string | null
  dateAdded: Date
  dateDeleted: Date | null
}
