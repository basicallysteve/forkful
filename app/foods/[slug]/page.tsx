'use client'

import { useParams } from 'next/navigation'
import { useFoodStore } from '@/stores/food'
import { toSlug } from '@/utils/slug'
import FoodIndex from '@/Pages/Food/Index'
import { notFound } from 'next/navigation'

export default function FoodPage() {
  const params = useParams()
  const slug = params.slug as string
  const foods = useFoodStore((state) => state.foods)
  const food = foods.find((f) => toSlug(f.name) === slug)

  if (!food) {
    notFound()
  }

  return <FoodIndex food={food!} />
}
