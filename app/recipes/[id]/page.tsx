import { notFound, permanentRedirect } from 'next/navigation'
import { getRecipeByShortId } from '@/lib/recipes'
import { getSessionUser } from '@/lib/auth'
import { toSlug } from '@/utils/slug'

type Props = { params: Promise<{ id: string }> }

export default async function RecipeShortIdPage({ params }: Props) {
  const { id } = await params
  const session = await getSessionUser()
  const recipe = await getRecipeByShortId(id, session?.userId)

  if (!recipe) notFound()

  permanentRedirect(`/recipes/${id}/${toSlug(recipe.name)}`)
}
