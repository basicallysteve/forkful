import { create } from 'zustand'
import type { ShoppingListItem } from '@/types/ShoppingList'

type ShoppingListStore = {
  items: ShoppingListItem[]
  setItems: (items: ShoppingListItem[]) => void
  addItem: (item: ShoppingListItem) => void
}

export const useShoppingListStore = create<ShoppingListStore>((set) => ({
  items: [],
  setItems: (items: ShoppingListItem[]) => set({ items }),
  addItem: (item: ShoppingListItem) => set((state) => ({ items: [...state.items, item] })),
}))

export const resetShoppingListStore = () => {
  useShoppingListStore.setState({ items: [] })
}
