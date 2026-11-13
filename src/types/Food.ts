export type FoodSource = 'manual' | 'open_food_facts' | 'usda'

export type Measurement = {
  unit: string
  gramsPerUnit?: number
  mlPerUnit?: number // volume calibration for a unit with no weight (ADR-0028); grams are tried first
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
  density?: number  // g/ml — enables mass↔volume conversion
  externalId?: string
  source?: FoodSource
}
