import { describe, it, expect, beforeEach } from 'vitest'
import { usePantryStore, resetPantryStore } from './pantry'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

const mockFood1: Food = {
  id: 1,
  name: 'Chicken Breast',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  servingSize: 100,
  servingUnit: 'g',
  measurements: ['g', 'oz'],
}

const mockFood2: Food = {
  id: 2,
  name: 'Brown Rice',
  calories: 216,
  protein: 5,
  carbs: 45,
  fat: 1.8,
  fiber: 3.5,
  servingSize: 1,
  servingUnit: 'cup',
  measurements: ['cup', 'g'],
}

describe('Pantry Store', () => {
  beforeEach(() => {
    resetPantryStore()
  })

  describe('Initial State', () => {
    it('should have empty items array initially', () => {
      const { items } = usePantryStore.getState()
      expect(items).toEqual([])
    })
  })

  describe('addItem', () => {
    it('should add a new item to the pantry', () => {
      const newItem: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: new Date('2025-12-20'),
        quantity: 2,
        addedDate: new Date('2025-12-10'),
      }

      usePantryStore.getState().addItem(newItem)
      const { items } = usePantryStore.getState()

      expect(items).toHaveLength(1)
      expect(items[0].food.id).toBe(1)
      expect(items[0].quantity).toBe(2)
    })

    it('should calculate and set status when adding item', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30) // 30 days from now

      const newItem: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: futureDate,
        quantity: 1,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(newItem)
      const { items } = usePantryStore.getState()

      expect(items[0].status).toBe('good')
    })

    it('should set status to expiring-soon for items expiring within 7 days', () => {
      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 5) // 5 days from now

      const newItem: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: soonDate,
        quantity: 1,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(newItem)
      const { items } = usePantryStore.getState()

      expect(items[0].status).toBe('expiring-soon')
    })

    it('should set status to expired for items past expiration date', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5) // 5 days ago

      const newItem: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: pastDate,
        quantity: 1,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(newItem)
      const { items } = usePantryStore.getState()

      expect(items[0].status).toBe('expired')
    })
  })

  describe('updateItem', () => {
    it('should update an existing item', () => {
      const item: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: new Date('2025-12-20'),
        quantity: 2,
        addedDate: new Date('2025-12-10'),
      }

      usePantryStore.getState().addItem(item)

      const updatedItem: PantryItem = {
        ...item,
        quantity: 5,
      }

      usePantryStore.getState().updateItem(updatedItem)
      const { items } = usePantryStore.getState()

      expect(items[0].quantity).toBe(5)
    })

    it('should recalculate status when updating expiration date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const item: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: futureDate,
        quantity: 2,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(item)

      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const updatedItem: PantryItem = {
        ...item,
        expirationDate: pastDate,
      }

      usePantryStore.getState().updateItem(updatedItem)
      const { items } = usePantryStore.getState()

      expect(items[0].status).toBe('expired')
    })
  })

  describe('deleteItem', () => {
    it('should remove an item from the pantry', () => {
      const item1: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: new Date('2025-12-20'),
        quantity: 2,
        addedDate: new Date('2025-12-10'),
      }

      const item2: PantryItem = {
        id: 2,
        food: mockFood2,
        expirationDate: new Date('2025-12-25'),
        quantity: 3,
        addedDate: new Date('2025-12-10'),
      }

      usePantryStore.getState().addItem(item1)
      usePantryStore.getState().addItem(item2)

      usePantryStore.getState().deleteItem(1)
      const { items } = usePantryStore.getState()

      expect(items).toHaveLength(1)
      expect(items[0].id).toBe(2)
    })
  })

  describe('getItemById', () => {
    it('should retrieve an item by id', () => {
      const item: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: new Date('2025-12-20'),
        quantity: 2,
        addedDate: new Date('2025-12-10'),
      }

      usePantryStore.getState().addItem(item)
      const retrievedItem = usePantryStore.getState().getItemById(1)

      expect(retrievedItem).toBeDefined()
      expect(retrievedItem?.id).toBe(1)
    })

    it('should return undefined for non-existent id', () => {
      const retrievedItem = usePantryStore.getState().getItemById(999)
      expect(retrievedItem).toBeUndefined()
    })
  })

  describe('getItemsByStatus', () => {
    beforeEach(() => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 5)

      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 5)

      const goodDate = new Date()
      goodDate.setDate(goodDate.getDate() + 30)

      const item1: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: expiredDate,
        quantity: 1,
        addedDate: new Date(),
      }

      const item2: PantryItem = {
        id: 2,
        food: mockFood2,
        expirationDate: soonDate,
        quantity: 1,
        addedDate: new Date(),
      }

      const item3: PantryItem = {
        id: 3,
        food: mockFood1,
        expirationDate: goodDate,
        quantity: 1,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(item1)
      usePantryStore.getState().addItem(item2)
      usePantryStore.getState().addItem(item3)
    })

    it('should filter items by expired status', () => {
      const expiredItems = usePantryStore.getState().getItemsByStatus('expired')
      expect(expiredItems).toHaveLength(1)
      expect(expiredItems[0].id).toBe(1)
    })

    it('should filter items by expiring-soon status', () => {
      const expiringSoonItems = usePantryStore.getState().getItemsByStatus('expiring-soon')
      expect(expiringSoonItems).toHaveLength(1)
      expect(expiringSoonItems[0].id).toBe(2)
    })

    it('should filter items by good status', () => {
      const goodItems = usePantryStore.getState().getItemsByStatus('good')
      expect(goodItems).toHaveLength(1)
      expect(goodItems[0].id).toBe(3)
    })
  })

  describe('getItemsByFood', () => {
    it('should filter items by food id', () => {
      const item1: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: new Date('2025-12-20'),
        quantity: 1,
        addedDate: new Date(),
      }

      const item2: PantryItem = {
        id: 2,
        food: mockFood2,
        expirationDate: new Date('2025-12-25'),
        quantity: 1,
        addedDate: new Date(),
      }

      const item3: PantryItem = {
        id: 3,
        food: mockFood1,
        expirationDate: new Date('2025-12-30'),
        quantity: 2,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(item1)
      usePantryStore.getState().addItem(item2)
      usePantryStore.getState().addItem(item3)

      const food1Items = usePantryStore.getState().getItemsByFood(1)
      expect(food1Items).toHaveLength(2)
      expect(food1Items[0].food.id).toBe(1)
      expect(food1Items[1].food.id).toBe(1)
    })
  })

  describe('calculateItemStatus', () => {
    it('should calculate status for a given date', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const status = usePantryStore.getState().calculateItemStatus(futureDate)
      expect(status).toBe('good')
    })
  })

  describe('refreshItemStatuses', () => {
    it('should recalculate all item statuses', () => {
      const date = new Date()
      date.setDate(date.getDate() + 5) // Will be expiring-soon

      const item: PantryItem = {
        id: 1,
        food: mockFood1,
        expirationDate: date,
        quantity: 1,
        addedDate: new Date(),
      }

      usePantryStore.getState().addItem(item)
      let { items } = usePantryStore.getState()
      expect(items[0].status).toBe('expiring-soon')

      // Manually change the expiration date to simulate time passing
      items[0].expirationDate = new Date(date.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days in the past

      usePantryStore.getState().refreshItemStatuses()
      items = usePantryStore.getState().items
      expect(items[0].status).toBe('expired')
    })
  })

  describe('setItems', () => {
    it('should replace all items and calculate statuses', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const items: PantryItem[] = [
        {
          id: 1,
          food: mockFood1,
          expirationDate: futureDate,
          quantity: 1,
          addedDate: new Date(),
        },
        {
          id: 2,
          food: mockFood2,
          expirationDate: futureDate,
          quantity: 2,
          addedDate: new Date(),
        },
      ]

      usePantryStore.getState().setItems(items)
      const { items: storeItems } = usePantryStore.getState()

      expect(storeItems).toHaveLength(2)
      expect(storeItems[0].status).toBe('good')
      expect(storeItems[1].status).toBe('good')
    })
  })
})
