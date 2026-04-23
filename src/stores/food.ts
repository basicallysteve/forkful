import { create } from 'zustand'
import type { Food } from '@/types/Food'
import type { Recipe } from '@/types/Recipe'
import { getInitialFoods } from './initialData'

type FoodStore = {
    foods: Food[]
    setFoods: (foods: Food[]) => void
    addFood: (food: Omit<Food, 'id'>) => void
    updateFood: (updatedFood: Food) => void
    deleteFood: (id: number) => void,
    getFoodByName: (name: string) => Food | undefined,
    isFoodUsedInRecipe: (foodId: number, recipes: Recipe[]) => boolean
}

export const useFoodStore = create<FoodStore>((set, get) => ({
    foods: getInitialFoods(),
    setFoods: (foods: Food[]) => set({ foods }),
    addFood: (food: Omit<Food, 'id'>) => set(state => {
        const id = state.foods.length > 0 ? Math.max(...state.foods.map(f => f.id)) + 1 : 1
        return { foods: [...state.foods, { ...food, id }] }
    }),
    updateFood: (updatedFood: Food) => set(state => ({
        foods: state.foods.map(food =>
            food.id === updatedFood.id ? updatedFood : food
        )
    })),
    deleteFood: (id: number) => set(state => ({
        foods: state.foods.filter(food => food.id !== id)
    })),
    getFoodByName: (name: string) => {
        const food = get().foods.find(f => f.name.toLowerCase() === name.toLowerCase())
        return food
    },
    isFoodUsedInRecipe: (foodId: number, recipes: Recipe[]): boolean => {
        return recipes.some(recipe =>
            recipe.ingredients.some(
                ingredient => ingredient.food.id === foodId
            )
        )
    }
}))

export const resetFoodStore = () => {
  useFoodStore.setState({ foods: getInitialFoods() })
}
