'use client'

import { useParams } from 'next/navigation'
import { useFoodStore } from '@/stores/food'
import { toSlug } from '@/utils/slug'
import FoodStore from '@/views/Food/Store'
import { notFound } from 'next/navigation'

export default function EditFoodPage() {
  const params = useParams()
  const slug = params.slug as string
  const foods = useFoodStore((state) => state.foods)
  const food = foods.find((f) => toSlug(f.name) === slug)

  if (!food) {
    notFound()
  }

  return <FoodStore existingFood={food!} />
}
