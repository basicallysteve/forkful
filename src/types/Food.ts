export type Macronutrients = {
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
}

export type Food = {
  id: number
  name: string
  calories: number
  macronutrients?: Macronutrients
  servingSize: number
  servingUnit?: string
  measurements?: string[]
}
