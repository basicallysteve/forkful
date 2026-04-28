import { createContext, useState, useMemo, useContext } from 'react';
import type { Recipe } from '@/types/Recipe';
import type { Ingredient } from '@/types/Ingredient';
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider';

export interface RecipeContextType {
  recipes: Recipe[];
  setRecipes: (recipes: Recipe[]) => void;
  existingIngredients: Ingredient[];
}

const GlobalRecipeContext = createContext<RecipeContextType | undefined>(undefined);


export const RecipeProvider = ({ children }: { children: React.ReactNode }) => {
    const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext);
    
    if (!foodContext) {
      throw new Error('FoodProvider must wrap RecipeProvider');
    }

    const [recipes, setRecipes] = useState<Recipe[]>([]);

  const existingIngredients = useMemo(() => {
    const detailedIngredients: Ingredient[] = recipes.flatMap(recipe => recipe.ingredients)
      .filter((ingredient, index, self) =>
        index === self.findIndex((ing) => ing.food.name === ingredient.food.name)
      ).map(ing => ({ 
        food: ing.food, 
        calories: ing.calories && ing.quantity > 0 ? Math.round((ing.calories / ing.quantity) * 100) / 100 : 0, 
        quantity: 1,
        servingUnit: ing.servingUnit
      }));

    return detailedIngredients;

}, [recipes]);


    return <GlobalRecipeContext.Provider value={{ recipes, setRecipes, existingIngredients }}>
      {children}
    </GlobalRecipeContext.Provider>
} 

export default GlobalRecipeContext;