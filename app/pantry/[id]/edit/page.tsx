'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import { usePantryStore } from '@/stores/pantry'
import { apiFetchPantryItem } from '@/lib/api/pantry'
import PantryStore from '@/views/Pantry/Store'
import type { PantryItem } from '@/types/PantryItem'

export default function EditPantryItemPage() {
  const params = useParams()
  const id = Number(params.id)

  if (!Number.isFinite(id) || !Number.isInteger(id)) notFound()

  const itemFromStore = usePantryStore((state) => state.items.find((i) => i.id === id))
  const [item, setItem] = useState<PantryItem | null | undefined>(itemFromStore)

  useEffect(() => {
    if (item !== undefined) return
    apiFetchPantryItem(id)
      .then((fetched) => setItem(fetched ?? null))
      .catch(() => setItem(null))
  }, [id, item])

  if (item === undefined) return null // still loading

  if (item === null) notFound()

  return <PantryStore existingItem={item} />
}
