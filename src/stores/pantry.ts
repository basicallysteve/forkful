import { create } from 'zustand'
import type { PantryItem, PantryItemStatus } from '@/types/PantryItem'

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

// Constants
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const EXPIRING_SOON_THRESHOLD_DAYS = 7

// Helper function to calculate status based on expiration date
const calculateStatus = (expirationDate: Date | null): PantryItemStatus => {
  // If no expiration date, item is considered good
  if (!expirationDate) {
    return 'good'
  }
  
  const now = new Date()
  const expDate = new Date(expirationDate)
  const daysUntilExpiration = Math.ceil((expDate.getTime() - now.getTime()) / MILLISECONDS_PER_DAY)

  if (daysUntilExpiration < 0) {
    return 'expired'
  } else if (daysUntilExpiration <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return 'expiring-soon'
  } else {
    return 'good'
  }
}

export const usePantryStore = create<PantryStore>((set, get) => ({
  items: [],
  setItems: (items: PantryItem[]) => {
    const itemsWithStatus = items.map(item => ({
      ...item,
      status: calculateStatus(item.expirationDate)
    }))
    set({ items: itemsWithStatus })
  },
  addItem: (item: PantryItem) => {
    const itemWithStatus = {
      ...item,
      status: calculateStatus(item.expirationDate)
    }
    set(state => ({ items: [...state.items, itemWithStatus] }))
  },
  updateItem: (updatedItem: PantryItem) => {
    const itemWithStatus = {
      ...updatedItem,
      status: calculateStatus(updatedItem.expirationDate)
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
    return get().items.filter(item => item.food.id === foodId)
  },
  getFrozenItems: () => {
    return get().items.filter(item => item.frozenDate !== null)
  },
  calculateItemStatus: (expirationDate: Date | null) => {
    return calculateStatus(expirationDate)
  },
  refreshItemStatuses: () => {
    set(state => ({
      items: state.items.map(item => ({
        ...item,
        status: calculateStatus(item.expirationDate)
      }))
    }))
  }
}))

export const resetPantryStore = () => {
  usePantryStore.setState({ items: [] })
}
