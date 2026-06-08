import { getRecipes } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import RecipesList from '@/views/Recipes/Index'

export default async function RecipesPage() {
  const session = await getSessionUser()
  const recipes = await getRecipes({ viewerId: session?.userId })
  return <RecipesList initialRecipes={recipes} />
}
