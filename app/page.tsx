import { getSessionUser } from '@/lib/auth'
import { getTopRecipes, getSavedRecipes } from '@/lib/recipes'
import { getExpiringPantryItems } from '@/lib/pantry'
import Home from '@/views/Home'

export default async function HomePage() {
  const session = await getSessionUser()

  if (session) {
    const [recipes, expiringItems] = await Promise.all([
      getSavedRecipes(session.userId, 3),
      getExpiringPantryItems(session.userId),
    ])
    return (
      <Home
        isAuthenticated
        username={session.username}
        recipes={recipes}
        expiringItems={expiringItems}
      />
    )
  }

  const recipes = await getTopRecipes(3)
  return <Home isAuthenticated={false} recipes={recipes} />
}
