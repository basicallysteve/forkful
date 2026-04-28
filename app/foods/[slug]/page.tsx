import { notFound } from 'next/navigation'
import { getFoodBySlug } from '@/lib/foods'
import FoodIndex from '@/views/Food/Index'

type Props = { params: Promise<{ slug: string }> }

export default async function FoodPage({ params }: Props) {
  const { slug } = await params
  const food = await getFoodBySlug(slug)

  if (!food) notFound()

  return <FoodIndex food={food} />
}
