import { notFound } from 'next/navigation'
import { getRecipeBySlug } from '@/lib/recipes'
import RecipeIndex from '@/views/Recipe/Index'

type Props = { params: Promise<{ slug: string }> }

export default async function RecipePage({ params }: Props) {
  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)

  if (!recipe) notFound()

  return <RecipeIndex recipe={recipe!} />
}
