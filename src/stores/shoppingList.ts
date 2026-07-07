import { create } from 'zustand'
import type { ShoppingListItem } from '@/types/ShoppingList'

type ShoppingListStore = {
  items: ShoppingListItem[]
  setItems: (items: ShoppingListItem[]) => void
  upsertItem: (item: ShoppingListItem) => void
}

export const useShoppingListStore = create<ShoppingListStore>((set) => ({
  items: [],
  setItems: (items: ShoppingListItem[]) => set({ items }),
  // Replace in place when the line already exists (the server merges duplicates), else append.
  upsertItem: (item: ShoppingListItem) => set((state) => {
    const index = state.items.findIndex((existing) => existing.id === item.id)
    if (index === -1) return { items: [...state.items, item] }
    const items = state.items.slice()
    items[index] = item
    return { items }
  }),
}))

export const resetShoppingListStore = () => {
  useShoppingListStore.setState({ items: [] })
}
