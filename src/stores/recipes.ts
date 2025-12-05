import { create } from 'zustand'
import type { Ingredient } from '@/types/Ingredient'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'
import { calculateCalories } from '@/utils/unitConversion'
import { buildInitialRecipes, getInitialFoods } from './initialData'

type RecipeStore = {
  recipes: Recipe[],
  existingIngredients: () => Ingredient[],
  setRecipes: (recipes: Recipe[]) => void,
  addRecipe: (recipe: Recipe) => void,
  updateRecipe: (updatedRecipe: Recipe) => void,
  deleteRecipe: (id: number) => void,
  updateIngredientQuantity: (recipeId: number, ingredientId: number, newQuantity: number) => void,
  updateIngredientServingUnit: (recipeId: number, ingredientId: number, newUnit: string) => void,
  removeIngredientFromExisting: (recipeId: number, foodId: number) => void,
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: buildInitialRecipes(getInitialFoods()),
  existingIngredients: () => get().recipes.flatMap(recipe => recipe.ingredients)
      .filter((ingredient, index, self) =>
        index === self.findIndex((ing) => ing.food.name === ingredient.food.name)
      ).map(ing => ({ 
        food: ing.food, 
        calories: ing.calories && ing.quantity > 0 ? Math.round((ing.calories / ing.quantity) * 100) / 100 : 0, 
        quantity: 1,
        servingUnit: ing.servingUnit
      })),
    setRecipes: (recipes: Recipe[]) => set({ recipes }),
    addRecipe: (recipe: Recipe) => set(state => ({ recipes: [...state.recipes, recipe] })),
    updateRecipe: (updatedRecipe: Recipe) => set(state => ({
        recipes: state.recipes.map(recipe =>
            recipe.id === updatedRecipe.id ? updatedRecipe : recipe
        )
    })),
    deleteRecipe: (id: number) => set(state => ({
        recipes: state.recipes.filter(recipe => recipe.id !== id)
    })),
    updateIngredientQuantity: (recipeId: number, ingredientId: number, newQuantity: number) => {
        set(state => ({
            recipes: state.recipes.map(recipe => {
                if (recipe.id === recipeId) {
                    return {
                        ...recipe,
                        ingredients: recipe.ingredients.map((ingredient, index) => {
                            if (index === ingredientId) {
                                const baseCalories = ingredient.calories
                                const baseServingSize = ingredient.quantity
                                const baseServingUnit = ingredient.servingUnit || ingredient.food.servingUnit || 'unit'

                                const calculatedCalories = calculateCalories({
                                  baseCalories,
                                  baseServingSize,
                                  baseServingUnit,
                                  targetAmount: newQuantity,
                                  targetUnit: baseServingUnit,
                                })

                                return {
                                    ...ingredient,
                                    quantity: newQuantity,
                                    calories: calculatedCalories !== null ? calculatedCalories : ingredient.calories,
                                }
                            }
                            return ingredient
                        }),
                    }
                }
                return recipe
            }),
        }))
    },
    updateIngredientServingUnit: (recipeId: number, ingredientId: number, newUnit: string) => {
        set(state => ({
            recipes: state.recipes.map(recipe => {
                if (recipe.id === recipeId) {
                    return {
                        ...recipe,
                        ingredients: recipe.ingredients.map((ingredient, index) => {
                            if (index === ingredientId) {
                                const baseCalories = ingredient.food.calories
                                const baseServingSize = ingredient.quantity
                                const food = ingredient.food
                                const baseServingUnit = ingredient.servingUnit || food.servingUnit || 'unit'

                                // Calculate calories based on the new unit
                                const calculatedCalories = calculateCalories({
                                  baseCalories,
                                  baseServingSize,
                                  baseServingUnit,
                                  targetAmount: ingredient.quantity,
                                  targetUnit: newUnit,
                                })

                                return {
                                    ...ingredient,
                                    servingUnit: newUnit,
                                    calories: calculatedCalories !== null ? calculatedCalories : ingredient.calories,
                                }
                            }
                            return ingredient
                        }),
                    }
                }
                return recipe
            }),
        }))
    },
    removeIngredientFromExisting: (recipeId: number, foodId: number) => {
        set(state => ({
            recipes: state.recipes.map(recipe => {
                if (recipe.id === recipeId) {
                    return {
                        ...recipe,
                        ingredients: recipe.ingredients.filter(ingredient => ingredient.food.id !== foodId),
                    }
                }
                return recipe
            }),
        }))
    },
}))

export const resetRecipeStore = () => {
  const foods = getInitialFoods()
  useRecipeStore.setState({ recipes: buildInitialRecipes(foods) })
}
    
