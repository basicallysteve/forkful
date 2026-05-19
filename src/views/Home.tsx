import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { getRecipes, getSavedRecipes } from '@/lib/recipes'
import RecipeCard from '@/components/RecipeCard/RecipeCard'

export default async function Home() {
  const session = await getSessionUser()

  const recipes = session
    ? (await getSavedRecipes(session.userId)).slice(0, 3)
    : (await getRecipes()).slice(0, 3)

  const heading = session ? `Welcome back, ${session.username}!` : 'Welcome to Forkful'
  const sectionTitle = session ? 'Your saved recipes' : 'Popular recipes'

  return (
    <div className="home">
      <h1>{heading}</h1>
      <p>Explore delicious recipes and manage your meal plans.</p>

      <section className="home-recipes">
        <h2>{sectionTitle}</h2>
        {recipes.length === 0 ? (
          <p className="no-recipes-text">
            {session
              ? 'No saved recipes yet. Browse recipes and save the ones you love!'
              : 'No recipes available yet.'}
          </p>
        ) : (
          <div className="recipe-cards">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
        <Link href="/recipes" className="ghost-button home-browse-link">
          Browse all recipes
        </Link>
      </section>
    </div>
  )
}
