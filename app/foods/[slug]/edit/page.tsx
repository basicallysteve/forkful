import { notFound } from 'next/navigation'
import { getFoodBySlug } from '@/lib/foods'
import FoodStore from '@/views/Food/Store'

type Props = { params: Promise<{ slug: string }> }

export default async function EditFoodPage({ params }: Props) {
  const { slug } = await params
  const food = await getFoodBySlug(slug)

  if (!food) notFound()

  return <FoodStore existingFood={food!} />
}
