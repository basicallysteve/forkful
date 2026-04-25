import type { Metadata } from 'next'
import ClientLayout from './ClientLayout'
import { getRecipes } from '@/lib/recipes'
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

  return (
    <html lang="en">
      <body>
        <ClientLayout recipes={recipes}>{children}</ClientLayout>
      </body>
    </html>
  )
}
