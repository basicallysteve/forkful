import { createContext, useState, useContext, useMemo } from 'react'
import type { Food } from '@/types/Food'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'

export interface FoodContextType {
  foods: Food[]
  setFoods: (foods: Food[]) => void
  addFood: (food: Omit<Food, 'id'>) => Food
  updateFood: (food: Food) => void
  deleteFood: (id: number) => boolean
  isFoodUsedInRecipe: (foodId: number) => boolean
  getFoodByName: (name: string) => Food | undefined
}

const GlobalFoodContext = createContext<FoodContextType | undefined>(undefined)

export const FoodProvider = ({ children }: { children: React.ReactNode }) => {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)

  const [foods, setFoods] = useState<Food[]>([
    {
      id: 1,
      name: 'Ham',
      calories: 75,
      macronutrients: { protein: 5, carbs: 1, fat: 6 },
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'oz', 'g'],
    },
    {
      id: 2,
      name: 'Cheese',
      calories: 100,
      macronutrients: { protein: 7, carbs: 0, fat: 8 },
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'oz', 'g'],
    },
    {
      id: 3,
      name: 'Bread',
      calories: 100,
      macronutrients: { protein: 3, carbs: 20, fat: 1 },
      servingSize: 1,
      servingUnit: 'slice',
      measurements: ['slice', 'loaf'],
    },
    {
      id: 4,
      name: 'Spaghetti',
      calories: 350,
      macronutrients: { protein: 13, carbs: 71, fat: 2 },
      servingSize: 100,
      servingUnit: 'g',
      measurements: ['g', 'oz', 'cup'],
    },
    {
      id: 5,
      name: 'Ground Beef',
      calories: 200,
      macronutrients: { protein: 26, carbs: 0, fat: 10 },
      servingSize: 100,
      servingUnit: 'g',
      measurements: ['g', 'oz', 'lb'],
    },
  ])

  // Check if a food is used in any recipe by matching the food name
  const isFoodUsedInRecipe = (foodId: number): boolean => {
    if (!recipeContext) return false
    const food = foods.find(f => f.id === foodId)
    if (!food) return false

    return recipeContext.recipes.some(recipe =>
      recipe.ingredients.some(
        ingredient => ingredient.name.toLowerCase() === food.name.toLowerCase()
      )
    )
  }

  const addFood = (foodData: Omit<Food, 'id'>): Food => {
    const newId = foods.length > 0 ? Math.max(...foods.map(f => f.id)) + 1 : 1
    const newFood: Food = { ...foodData, id: newId }
    setFoods([...foods, newFood])
    return newFood
  }

  const updateFood = (updatedFood: Food): void => {
    setFoods(foods.map(f => (f.id === updatedFood.id ? updatedFood : f)))
  }

  const deleteFood = (id: number): boolean => {
    if (isFoodUsedInRecipe(id)) {
      return false
    }
    setFoods(foods.filter(f => f.id !== id))
    return true
  }

  const getFoodByName = (name: string): Food | undefined => {
    return foods.find(f => f.name.toLowerCase() === name.toLowerCase())
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foods, recipeContext?.recipes]
  )

  return (
    <GlobalFoodContext.Provider value={contextValue}>
      {children}
    </GlobalFoodContext.Provider>
  )
}

export default GlobalFoodContext
