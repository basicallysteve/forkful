import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'

export const DEFAULT_SERVING_UNIT = 'g'

export const initialFoodsData: Food[] = [
  { id: 1, name: 'Ham', calories: 75, protein: 5, carbs: 1, fat: 6, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 2, name: 'Cheese', calories: 100, protein: 7, carbs: 0, fat: 8, fiber: 0, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'oz', 'g'] },
  { id: 3, name: 'Bread', calories: 100, protein: 3, carbs: 20, fat: 1, fiber: 2, servingSize: 1, servingUnit: 'slice', measurements: ['slice', 'loaf'] },
  { id: 4, name: 'Spaghetti', calories: 350, protein: 13, carbs: 71, fat: 2, fiber: 3, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'cup'] },
  { id: 5, name: 'Ground Beef', calories: 200, protein: 26, carbs: 0, fat: 10, fiber: 0, servingSize: 100, servingUnit: 'g', measurements: ['g', 'oz', 'lb'] },
]

export const getInitialFoods = (): Food[] => JSON.parse(JSON.stringify(initialFoodsData))

export const buildInitialRecipes = (foods: Food[]): Recipe[] => {
  const findFood = (name: string) => {
    const food = foods.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (!food) throw new Error(`Missing seed food: ${name}`)
    return food
  }

  const hamFood = findFood('Ham')
  const cheeseFood = findFood('Cheese')
  const breadFood = findFood('Bread')
  const spaghettiFood = findFood('Spaghetti')
  const groundBeefFood = findFood('Ground Beef')

  return [
    {
      id: 1,
      name: 'Ham and Cheese Sandwich',
      meal: 'Lunch',
      description: 'A delicious sandwich made with ham and cheese.',
      ingredients: [
        { food: hamFood, quantity: 2, calories: 150, servingUnit: hamFood.servingUnit || DEFAULT_SERVING_UNIT },
        { food: cheeseFood, quantity: 1, calories: 100, servingUnit: cheeseFood.servingUnit || DEFAULT_SERVING_UNIT },
        { food: breadFood, quantity: 2, calories: 200, servingUnit: breadFood.servingUnit || DEFAULT_SERVING_UNIT },
      ],
      date_added: new Date('2025-11-21'),
      date_published: new Date('2025-11-22'),
    },
    {
      id: 2,
      name: 'Spaghetti Bolognese',
      meal: 'Dinner',
      description: 'A classic Italian pasta dish with a rich meat sauce.',
      ingredients: [
        { food: spaghettiFood, quantity: 1, calories: 350, servingUnit: spaghettiFood.servingUnit || DEFAULT_SERVING_UNIT },
        { food: groundBeefFood, quantity: 2, calories: 400, servingUnit: groundBeefFood.servingUnit || DEFAULT_SERVING_UNIT },
      ],
      date_added: new Date('2025-12-01'),
      date_published: new Date('2025-12-02'),
    },
  ]
}

export const getInitialRecipes = (foods: Food[] = getInitialFoods()): Recipe[] =>
  JSON.parse(JSON.stringify(buildInitialRecipes(foods)))
