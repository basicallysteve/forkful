export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import ClientLayout from './ClientLayout'
import { getRecipes } from '@/lib/recipes'
import { decrypt } from '@/lib/session'
import type { Recipe } from '@/types/Recipe'
import './globals.scss'

export const metadata: Metadata = {
  title: 'Forkful',
  description: 'Recipes worth repeating',
  icons: {
    icon: '/forkful-favicon.svg',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const recipes: Recipe[] = await getRecipes()

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  let isLoggedIn = false
  if (sessionCookie) {
    const session = await decrypt(sessionCookie).catch(() => null)
    isLoggedIn = !!session
  }

  return (
    <html lang="en">
      <body>
        <ClientLayout recipes={recipes} isLoggedIn={isLoggedIn}>{children}</ClientLayout>
      </body>
    </html>
  )
}
