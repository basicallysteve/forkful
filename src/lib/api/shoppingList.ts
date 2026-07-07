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

export type CreateShoppingListProductItemData = {
  productId: number
  amount: number
  unit: string
}

export type CreateShoppingListFreeformItemData = {
  name: string
  amount: number
  unit?: string | null
}

export async function apiFetchShoppingListItems(): Promise<ShoppingListItem[]> {
  const res = await fetch('/api/shopping-list')
  if (!res.ok) throw new Error('Failed to fetch shopping list items')
  const raw: RawShoppingListItem[] = await res.json()
  return raw.map(parseShoppingListItem)
}

async function postShoppingListItem(body: Record<string, unknown>): Promise<ShoppingListItem> {
  const res = await fetch('/api/shopping-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error('Failed to create shopping list item')
  const raw: RawShoppingListItem = await res.json()
  return parseShoppingListItem(raw)
}

export async function apiCreateShoppingListFoodItem(data: CreateShoppingListFoodItemData): Promise<ShoppingListItem> {
  return postShoppingListItem({ sourceType: 'food', ...data })
}

export async function apiCreateShoppingListProductItem(data: CreateShoppingListProductItemData): Promise<ShoppingListItem> {
  return postShoppingListItem({ sourceType: 'product', ...data })
}

export async function apiCreateShoppingListFreeformItem(data: CreateShoppingListFreeformItemData): Promise<ShoppingListItem> {
  return postShoppingListItem({ sourceType: 'freeform', ...data })
}
