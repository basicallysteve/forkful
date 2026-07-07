import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { taskRunner } from '@/lib/TaskRunner'
import { getOrCreateActiveShoppingList, getShoppingListItems } from '@/lib/shoppingList'
import ShoppingListView from '@/views/ShoppingList/Index'

export default async function ShoppingListPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  // Ensure the user has an active shopping list before its items are read.
  await taskRunner.run(() => getOrCreateActiveShoppingList(sessionUser.userId))

  // Only the user's own list items are fetched server-side — they're the page's actual content. The
  // (global, unbounded) food catalog that powers FoodSearch's instant suggestions is loaded lazily on
  // the client instead, so it never blocks this render or bloats the payload.
  const initialItems = await getShoppingListItems(sessionUser.userId)

  return <ShoppingListView initialItems={initialItems} />
}
