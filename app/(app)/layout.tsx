export const dynamic = 'force-dynamic'

import ClientLayout from './ClientLayout'
import { getRecipes } from '@/lib/recipes'
import { auth } from '@/auth'
import type { Recipe } from '@/types/Recipe'
import 'primereact/resources/themes/lara-dark-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const recipes: Recipe[] = await getRecipes()

  const session = await auth()
  const isLoggedIn = !!session?.user
  const username = session?.user?.name ?? null
  const avatarUrl = session?.user?.image ?? null

  return (
    <ClientLayout recipes={recipes} isLoggedIn={isLoggedIn} username={username} avatarUrl={avatarUrl}>
      {children}
    </ClientLayout>
  )
}
