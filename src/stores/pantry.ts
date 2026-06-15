import { create } from 'zustand'
import type { PantryItem, PantryItemStatus } from '@/types/PantryItem'
import { calculatePantryStatus } from '@/utils/pantryStatus'

type PantryStore = {
  items: PantryItem[]
  setItems: (items: PantryItem[]) => void
  addItem: (item: PantryItem) => void
  updateItem: (updatedItem: PantryItem) => void
  deleteItem: (id: number) => void
  freezeItem: (id: number) => void
  unfreezeItem: (id: number) => void
  getItemById: (id: number) => PantryItem | undefined
  getItemsByStatus: (status: PantryItemStatus) => PantryItem[]
  getItemsByFood: (foodId: number) => PantryItem[]
  getFrozenItems: () => PantryItem[]
  calculateItemStatus: (expirationDate: Date | null) => PantryItemStatus
  refreshItemStatuses: () => void
}

export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  setItems: (items: PantryItem[]) => {
    const itemsWithStatus = items.map(item => ({
      ...item,
      status: calculatePantryStatus(item.expirationDate)
    }))
    set({ items: itemsWithStatus })
  },
  addItem: (item: PantryItem) => {
    const itemWithStatus = {
      ...item,
      status: calculatePantryStatus(item.expirationDate)
    }
    set(state => ({ items: [...state.items, itemWithStatus] }))
  },
  updateItem: (updatedItem: PantryItem) => {
    const itemWithStatus = {
      ...updatedItem,
      status: calculatePantryStatus(updatedItem.expirationDate)
    }
    set(state => ({
      items: state.items.map(item =>
        item.id === updatedItem.id ? itemWithStatus : item
      )
    }))
  },
  deleteItem: (id: number) => set(state => ({
    items: state.items.filter(item => item.id !== id)
  })),
  freezeItem: (id: number) => set(state => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, frozenDate: new Date() } : item
    )
  })),
  unfreezeItem: (id: number) => set(state => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, frozenDate: null } : item
    )
  })),
  getItemById: (id: number) => {
    return get().items.find(item => item.id === id)
  },
  getItemsByStatus: (status: PantryItemStatus) => {
    return get().items.filter(item => item.status === status)
  },
  getItemsByFood: (foodId: number) => {
    return get().items.filter(item => item.food?.id === foodId)
  },
  getFrozenItems: () => {
    return get().items.filter(item => item.frozenDate !== null)
  },
  calculateItemStatus: (expirationDate: Date | null) => {
    return calculatePantryStatus(expirationDate)
  },
  refreshItemStatuses: () => {
    set(state => ({
      items: state.items.map(item => ({
        ...item,
        status: calculatePantryStatus(item.expirationDate)
      }))
    }))
  }
}))

export const resetPantryStore = () => {
  usePantryStore.setState({ items: [] })
}
