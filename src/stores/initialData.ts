import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'

export const DEFAULT_SERVING_UNIT = 'g'

export const initialFoodsData: Food[] = [
  { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'oz' }, { unit: 'g' }] },
  { id: 2, name: 'Cheese', calories: 100, protein: 7, carbs: 0, fat: 8, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'oz' }, { unit: 'g' }] },
  { id: 3, name: 'Bread', calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 2, servingSize: 1, servingUnit: 'slice', measurements: [{ unit: 'slice' }, { unit: 'loaf' }] },
  { id: 4, name: 'Spaghetti', calories: 350, protein: 13, carbs: 71, fat: 2, fiber: 3, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'oz' }, { unit: 'cup' }] },
  { id: 5, name: 'Ground Beef', calories: 200, protein: 26, carbs: 0, fat: 10, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }, { unit: 'oz' }, { unit: 'lb' }] },
]

export const getInitialFoods = (): Food[] => JSON.parse(JSON.stringify(initialFoodsData))

export const buildInitialRecipes = (): Recipe[] => {
  return []
}

export const getInitialRecipes = (): Recipe[] =>
  JSON.parse(JSON.stringify(buildInitialRecipes()))
