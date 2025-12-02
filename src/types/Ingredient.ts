import type { Food } from '@/types/Food'

export type Ingredient = {
  name: string
  quantity: number,
  units?: string,
  calories?: number,
  food?: Food
}