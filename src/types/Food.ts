export type FoodSource = 'manual' | 'open_food_facts'

export type Measurement = {
  unit: string
  gramsPerUnit?: number
}

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
  servingUnit: string
  measurements: Measurement[]
  barcode?: string
  source?: FoodSource
}
