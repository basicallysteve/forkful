export type FoodSource = 'manual' | 'open_food_facts'

export type Food = {
  id: number
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  saturatedFat?: number
  sugar?: number
  sodium?: number   // mg per serving
  servingSize: number
  servingUnit?: string
  measurements?: string[]
  barcode?: string
  source?: FoodSource
}
