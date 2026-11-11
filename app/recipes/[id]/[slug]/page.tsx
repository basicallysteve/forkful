import { notFound, permanentRedirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getRecipeByShortId, getRecipeSummaryByShortId, isSaved } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { toSlug } from '@/utils/slug'
import RecipeIndex from '@/views/Recipe/Index'
import RecipeViewBeacon from '@/components/RecipeViewBeacon/RecipeViewBeacon'

type Props = { params: Promise<{ id: string; slug: string }> }

export default async function RecipePage({ params }: Props) {
  const { id, slug } = await params
  // The food catalog only powers ingredient editing, so it's loaded lazily on the client (see
  // RecipeIndex) rather than shipped with every — mostly read-only, often anonymous — recipe view.
  const [session, requestHeaders] = await Promise.all([getSessionUser(), headers()])

  // The Signup Wall applies only to Anonymous Visitors; the meter decision is set
  // authoritatively by middleware. Gating a logged-in user is impossible here even
  // if the header were forged, since `gated` also requires no session.
  const gated = requestHeaders.get('x-recipe-gated') === '1' && session === null
  const viewerId = session?.userId

  const recipe = gated
    ? await getRecipeSummaryByShortId(id, viewerId)
    : await getRecipeByShortId(id, viewerId)

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
        canEdit={isOwner}
        canSave={canSave}
        initialSaved={initialSaved}
        isLoggedIn={session !== null}
        gated={gated}
      />
    </>
  )
}
