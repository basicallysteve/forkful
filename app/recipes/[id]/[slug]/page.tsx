import { notFound, permanentRedirect } from 'next/navigation'
import { getRecipeByShortId, isSaved } from '@/lib/recipes'
import { getFoods } from '@/lib/foods'
import { getSessionUser } from '@/lib/auth'
import { toSlug } from '@/utils/slug'
import RecipeIndex from '@/views/Recipe/Index'
import RecipeViewBeacon from '@/components/RecipeViewBeacon/RecipeViewBeacon'

type Props = { params: Promise<{ id: string; slug: string }> }

export default async function RecipePage({ params }: Props) {
  const { id, slug } = await params
  const [foods, session] = await Promise.all([getFoods(), getSessionUser()])
  const recipe = await getRecipeByShortId(id, session?.userId)

  if (!recipe) notFound()

  const canonicalSlug = toSlug(recipe.name)
  if (slug !== canonicalSlug) {
    permanentRedirect(`/recipes/${id}/${canonicalSlug}`)
  }

  const isOwner = session !== null && recipe.userId === session.userId
  const canSave = session !== null && recipe.isPublic && !isOwner
  const initialSaved = canSave ? await isSaved(session!.userId, recipe.id) : false

  return (
    <>
      <RecipeViewBeacon shortId={recipe.shortId} />
      <RecipeIndex
        recipe={recipe}
        foods={foods}
        canEdit={isOwner}
        canSave={canSave}
        initialSaved={initialSaved}
        isLoggedIn={session !== null}
      />
    </>
  )
}
