import { type Ingredient } from "@/types/Ingredient"
export type Recipe = {
  name: string
  meal?: "Lunch" | "Dinner" | "Breakfast" | "Snack" | "Dessert"
  description: string
  ingredients: Ingredient[],
  date_added?: Date
}