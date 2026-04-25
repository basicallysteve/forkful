import { getRecipes } from '@/lib/recipes'
import RecipesList from '@/views/Recipes/Index'

export default async function RecipesPage() {
  const recipes = await getRecipes()
  return <RecipesList initialRecipes={recipes} />
}
