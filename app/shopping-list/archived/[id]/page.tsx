import { notFound, redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getArchivedShoppingListById } from '@/lib/shoppingList'
import ArchivedShoppingListDetail from '@/views/ShoppingList/ArchivedDetail'

type Params = { params: Promise<{ id: string }> }

export default async function ArchivedShoppingListPage({ params }: Params) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const list = await getArchivedShoppingListById(id, sessionUser.userId)
  if (!list) notFound()

  return <ArchivedShoppingListDetail list={list} />
}
