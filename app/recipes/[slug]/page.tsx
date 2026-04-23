'use client'

import { useParams } from 'next/navigation'
import { useRecipeStore } from '@/stores/recipes'
import { toSlug } from '@/utils/slug'
import RecipeIndex from '@/Pages/Recipe/Index'
import { notFound } from 'next/navigation'

export default function RecipePage() {
  const params = useParams()
  const slug = params.slug as string
  const recipes = useRecipeStore((state) => state.recipes)
  const recipe = recipes.find((r) => toSlug(r.name) === slug)

  if (!recipe) {
    notFound()
  }

  return <RecipeIndex recipe={recipe!} />
}
