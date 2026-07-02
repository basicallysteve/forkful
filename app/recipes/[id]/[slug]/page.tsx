import { notFound, permanentRedirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getRecipeByShortId, getRecipeSummaryByShortId, isSaved } from '@/lib/recipes'
import { getFoods } from '@/lib/foods'
import { getSessionUser } from '@/lib/auth'
import { toSlug } from '@/utils/slug'
import { serializeRecipeJsonLd } from '@/utils/recipeJsonLd'
import RecipeIndex from '@/views/Recipe/Index'

type Props = { params: Promise<{ id: string; slug: string }> }

export default async function RecipePage({ params }: Props) {
  const { id, slug } = await params
  const [foods, session, requestHeaders] = await Promise.all([getFoods(), getSessionUser(), headers()])

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
      {recipe.isPublic && (
        <script
          type="application/ld+json"
          // Declared metered content so the Crawler Exemption reads as flexible
          // sampling, not cloaking. See ADR-0020.
          dangerouslySetInnerHTML={{ __html: serializeRecipeJsonLd(recipe) }}
        />
      )}
      <RecipeIndex
        recipe={recipe}
        foods={foods}
        canEdit={isOwner}
        canSave={canSave}
        initialSaved={initialSaved}
        isLoggedIn={session !== null}
        gated={gated}
      />
    </>
  )
}
