export interface OFFNutriments {
  'energy-kcal_100g'?: number
  'proteins_100g'?: number
  'carbohydrates_100g'?: number
  'sugars_100g'?: number
  'fat_100g'?: number
  'saturated-fat_100g'?: number
  'fiber_100g'?: number
  'sodium_100g'?: number
}

export interface OFFProduct {
  code: string
  product_name: string
  nutriments?: OFFNutriments
  serving_size?: string
  serving_quantity?: number
}
