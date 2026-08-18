import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getArchivedShoppingLists } from '@/lib/shoppingList'
import ArchivedShoppingLists from '@/views/ShoppingList/Archived'

export default async function ArchivedShoppingListsPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const lists = await getArchivedShoppingLists(sessionUser.userId)
  return <ArchivedShoppingLists lists={lists} />
}
