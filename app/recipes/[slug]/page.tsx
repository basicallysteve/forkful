import { notFound } from 'next/navigation'
import { getRecipeBySlug, isSaved } from '@/lib/recipes'
import { getFoods } from '@/lib/foods'
import { getSessionUser } from '@/lib/auth'
import RecipeIndex from '@/views/Recipe/Index'

type Props = { params: Promise<{ slug: string }> }

export default async function RecipePage({ params }: Props) {
  const { slug } = await params
  const [foods, session] = await Promise.all([getFoods(), getSessionUser()])
  const recipe = await getRecipeBySlug(slug, session?.userId)

  if (!recipe) notFound()

  const isOwner = session !== null && recipe.userId === session.userId
  const canSave = session !== null && recipe.isPublic && !isOwner
  const initialSaved = canSave ? await isSaved(session!.userId, recipe.id) : false

  return (
    <RecipeIndex
      recipe={recipe}
      foods={foods}
      canEdit={isOwner}
      canSave={canSave}
      initialSaved={initialSaved}
    />
  )
}
