import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getFoods } from '@/lib/foods'
import { taskRunner } from '@/lib/TaskRunner'
import { getOrCreateActiveShoppingList, getShoppingListItems } from '@/lib/shoppingList'
import ShoppingListView from '@/views/ShoppingList/Index'

export default async function ShoppingListPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const [initialFoods] = await Promise.all([
    getFoods(),
    taskRunner.run(() => getOrCreateActiveShoppingList(sessionUser.userId)),
  ])

  const initialItems = await getShoppingListItems(sessionUser.userId)

  return <ShoppingListView initialFoods={initialFoods} initialItems={initialItems} />
}
