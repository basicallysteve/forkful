import type { Food } from '@/types/Food'

export type Ingredient = {
  food: Food
  quantity: number
  calories: number
  servingUnit: string
}