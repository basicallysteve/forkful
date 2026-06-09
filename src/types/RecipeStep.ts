export type RecipeStep = {
  id: number
  recipeId: number
  position: number
  title?: string | null
  content: string
  dateAdded?: Date
}
