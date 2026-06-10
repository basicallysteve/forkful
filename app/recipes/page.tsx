import { getRecipes, getForYouRecipes } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { getUser } from '@/lib/users'
import RecipesList from '@/views/Recipes/Index'

export default async function RecipesPage() {
  const session = await getSessionUser()
  const user = session ? await getUser(session.userId) : null
  const cuisinePreferences = user?.cuisinePreferences ?? []
  const dietaryRestrictions = user?.dietaryRestrictions ?? []

  const [recipes, forYouRecipes] = await Promise.all([
    getRecipes({ viewerId: session?.userId }),
    getForYouRecipes(cuisinePreferences),
  ])

  return (
    <RecipesList
      initialRecipes={recipes}
      forYouRecipes={forYouRecipes}
      dietaryRestrictions={dietaryRestrictions}
    />
  )
}
