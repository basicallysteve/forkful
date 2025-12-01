import { type Ingredient } from "@/types/Ingredient"
export type Recipe = {
  id: number
  name: string
  meal?: "Lunch" | "Dinner" | "Breakfast" | "Snack" | "Dessert"
  description: string
  ingredients: Ingredient[],
  date_added?: Date
  date_published?: Date | null
}
