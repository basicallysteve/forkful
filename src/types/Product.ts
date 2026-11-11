import type { Measurement } from './Food'

export type ProductSource = 'manual' | 'open_food_facts' | 'usda_branded'

export type Product = {
  id: number
  name: string
  slug?: string
  barcode?: string
  externalId?: string
  parentFoodId?: number
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
  source?: ProductSource
}
