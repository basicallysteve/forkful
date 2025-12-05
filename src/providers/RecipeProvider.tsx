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

// Default serving unit constant
const DEFAULT_SERVING_UNIT = 'g';

export const RecipeProvider = ({ children }: { children: React.ReactNode }) => {
    const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext);
    
    if (!foodContext) {
      throw new Error('FoodProvider must wrap RecipeProvider');
    }

    const { foods } = foodContext;

    // Helper to get food by name - throws if not found (for required initial data)
    const getRequiredFood = (name: string) => {
      const food = foods.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (!food) {
        throw new Error(`Required food "${name}" not found in FoodProvider`);
      }
      return food;
    };

    // Create initial recipes with food relationships - these foods must exist
    const hamFood = getRequiredFood('Ham');
    const cheeseFood = getRequiredFood('Cheese');
    const breadFood = getRequiredFood('Bread');
    const spaghettiFood = getRequiredFood('Spaghetti');
    const groundBeefFood = getRequiredFood('Ground Beef');

    const [recipes, setRecipes] = useState<Recipe[]>([
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
  ]);

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