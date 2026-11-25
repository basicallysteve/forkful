import { create } from 'zustand'
import type { Ingredient } from '@/types/Ingredient'
import type { Recipe } from '@/types/Recipe'

type RecipeStore = {
  recipes: Recipe[],
  existingIngredients: () => Ingredient[],
  setRecipes: (recipes: Recipe[]) => void,
  addRecipe: (recipe: Recipe) => void,
  updateRecipe: (updatedRecipe: Recipe) => void,
  deleteRecipe: (id: number) => void,
  removeIngredientFromExisting: (recipeId: number, foodId: number) => void,
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
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
  useRecipeStore.setState({ recipes: [] })
}
    
