'use client'

import { useParams } from 'next/navigation'
import { usePantryStore } from '@/stores/pantry'
import PantryStore from '@/views/Pantry/Store'
import { notFound } from 'next/navigation'

export default function EditPantryItemPage() {
  const params = useParams()
  const id = Number(params.id)
  const items = usePantryStore((state) => state.items)
  const item = items.find((i) => i.id === id)

  if (!item) {
    notFound()
  }

  return <PantryStore existingItem={item!} />
}
