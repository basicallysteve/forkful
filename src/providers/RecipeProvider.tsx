import { createContext, useState, useMemo } from 'react';
import type { Recipe } from '@/types/Recipe';
import type { Ingredient } from '@/types/Ingredient';
export interface RecipeContextType {
  recipes: Recipe[];
  setRecipes: (recipes: Recipe[]) => void;
  existingIngredients: Ingredient[];
}

const GlobalRecipeContext = createContext<RecipeContextType | undefined>(undefined);

export const RecipeProvider = ({ children }: { children: React.ReactNode }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([
      {
      id: 1,
      name: 'Ham and Cheese Sandwich',
      meal: 'Lunch',
      description: 'A delicious sandwich made with ham and cheese.',
      ingredients: [
        { name: 'Ham', quantity: 2, calories: 150 },
        { name: 'Cheese', quantity: 1, calories: 100 },
        { name: 'Bread', quantity: 2, calories: 200 },
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
        { name: 'Spaghetti', quantity: 100, calories: 350 },
        { name: 'Ground Beef', quantity: 200, calories: 400 },
        { name: 'Tomato Sauce', quantity: 150, calories: 80 },
      ],
      date_added: new Date('2025-12-01'),
      date_published: new Date('2025-12-02'),
    },
    { 
      id: 3,
      name: 'Caesar Salad',
      meal: 'Lunch',
      description: 'A fresh salad with romaine lettuce, croutons, and Caesar dressing.',
      ingredients: [
        { name: 'Romaine Lettuce', quantity: 100, calories: 15 },
        { name: 'Croutons', quantity: 50, calories: 200 },
        { name: 'Caesar Dressing', quantity: 30, calories: 150 },
      ],
      date_added: new Date('2025-12-01'),
      date_published: new Date('2025-12-06'),
    }
  ]);

  const existingIngredients = useMemo(() => {
    const ingredientSet = new Set<string>();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        ingredientSet.add(ingredient.name);
      });
    });

    const detailedIngredients: Ingredient[] =  recipes.flatMap(recipe => recipe.ingredients)
      .filter((ingredient, index, self) =>
        index === self.findIndex((ing) => ing.name === ingredient.name)
      ).map(ing => ({ name: ing.name, calories: ing.calories ? Math.round((ing.calories / ing.quantity) * 100) / 100 : 0, quantity: 1 }));

    return detailedIngredients;

}, [recipes]);


    return <GlobalRecipeContext.Provider value={{ recipes, setRecipes, existingIngredients }}>
      {children}
    </GlobalRecipeContext.Provider>
} 

export default GlobalRecipeContext;