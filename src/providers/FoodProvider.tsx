import { createContext, useState, useMemo, useCallback } from 'react'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'

export interface FoodContextType {
  foods: Food[]
  setFoods: (foods: Food[]) => void
  addFood: (food: Omit<Food, 'id'>) => Food
  updateFood: (food: Food) => void
  deleteFood: (id: number, recipes?: Recipe[]) => boolean
  isFoodUsedInRecipe: (foodId: number, recipes: Recipe[]) => boolean
  getFoodByName: (name: string) => Food | undefined
}

const GlobalFoodContext = createContext<FoodContextType | undefined>(undefined)

export const FoodProvider = ({ children }: { children: React.ReactNode }) => {
  const [foods, setFoods] = useState<Food[]>([
    {
      id: 1,
      name: 'Ham',
      calories: 75,
      protein: 5,
      carbs: 1,
      fat: 6,
      fiber: 0,
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'oz', 'g'],
    },
    {
      id: 2,
      name: 'Cheese',
      calories: 100,
      protein: 7,
      carbs: 0,
      fat: 8,
      fiber: 0,
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'oz', 'g'],
    },
    {
      id: 3,
      name: 'Bread',
      calories: 100,
      protein: 3,
      carbs: 20,
      fat: 1,
      fiber: 2,
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'loaf'],
    },
    {
      id: 4,
      name: 'Spaghetti',
      calories: 350,
      protein: 13,
      carbs: 71,
      fat: 2,
      fiber: 3,
      servingSize: 100,
      servingUnit: 'g',
      measurements: ['g', 'oz', 'cup'],
    },
    {
      id: 5,
      name: 'Ground Beef',
      calories: 200,
      protein: 26,
      carbs: 0,
      fat: 10,
      fiber: 0,
      servingSize: 100,
      servingUnit: 'g',
      measurements: ['g', 'oz', 'lb'],
    },
  ])

  // Check if a food is used in any recipe by matching the food id
  const isFoodUsedInRecipe = useCallback((foodId: number, recipes: Recipe[]): boolean => {
    return recipes.some(recipe =>
      recipe.ingredients.some(
        ingredient => ingredient.food.id === foodId
      )
    )
  }, [])

  const addFood = useCallback((foodData: Omit<Food, 'id'>): Food => {
    const newId = foods.length > 0 ? Math.max(...foods.map(f => f.id)) + 1 : 1
    const newFood: Food = { ...foodData, id: newId }
    setFoods(prevFoods => [...prevFoods, newFood])
    return newFood
  }, [foods])

  const updateFood = useCallback((updatedFood: Food): void => {
    setFoods(prevFoods => prevFoods.map(f => (f.id === updatedFood.id ? updatedFood : f)))
  }, [])

  const deleteFood = useCallback((id: number, recipes: Recipe[] = []): boolean => {
    if (isFoodUsedInRecipe(id, recipes)) {
      return false
    }
    setFoods(prevFoods => prevFoods.filter(f => f.id !== id))
    return true
  }, [isFoodUsedInRecipe])

  const getFoodByName = useCallback((name: string): Food | undefined => {
    return foods.find(f => f.name.toLowerCase() === name.toLowerCase())
  }, [foods])

  const contextValue = useMemo(
    () => ({
      foods,
      setFoods,
      addFood,
      updateFood,
      deleteFood,
      isFoodUsedInRecipe,
      getFoodByName,
    }),
    [foods, addFood, updateFood, deleteFood, isFoodUsedInRecipe, getFoodByName]
  )

  return (
    <GlobalFoodContext.Provider value={contextValue}>
      {children}
    </GlobalFoodContext.Provider>
  )
}

export default GlobalFoodContext
