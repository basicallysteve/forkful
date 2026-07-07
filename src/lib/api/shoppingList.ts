import type { ShoppingListItem } from '@/types/ShoppingList'

type RawShoppingListItem = Omit<ShoppingListItem, 'addedDate'> & {
  addedDate: string
}

function parseShoppingListItem(raw: RawShoppingListItem): ShoppingListItem {
  return {
    ...raw,
    addedDate: new Date(raw.addedDate),
  }
}

export type CreateShoppingListFoodItemData = {
  foodId: number
  amount: number
  unit: string
}

export async function apiFetchShoppingListItems(): Promise<ShoppingListItem[]> {
  const res = await fetch('/api/shopping-list')
  if (!res.ok) throw new Error('Failed to fetch shopping list items')
  const raw: RawShoppingListItem[] = await res.json()
  return raw.map(parseShoppingListItem)
}

export async function apiCreateShoppingListFoodItem(data: CreateShoppingListFoodItemData): Promise<ShoppingListItem> {
  const res = await fetch('/api/shopping-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) throw new Error('Failed to create shopping list item')
  const raw: RawShoppingListItem = await res.json()
  return parseShoppingListItem(raw)
}
