import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { getRecipes, getSavedRecipes } from '@/lib/recipes'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const totalCalories = recipe.ingredients.reduce((sum, ing) => sum + (ing.calories || 0), 0)
  return (
    <Link href={`/recipes/${toSlug(recipe.name)}`} className="home-recipe-card">
      <div className="card-header">
        <h3 className="card-title">{recipe.name}</h3>
        {recipe.meal && <span className="pill pill-ghost">{recipe.meal}</span>}
      </div>
      <div className="card-footer">
        <span className="card-meta">{recipe.ingredients.length} ingredients</span>
        {totalCalories > 0 && <span className="card-meta">{totalCalories} cal</span>}
      </div>
    </Link>
  )
}

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
