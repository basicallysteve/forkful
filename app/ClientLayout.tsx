'use client'

import ToolBar from '@/components/ToolBar'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'
import { PrimeReactProvider } from 'primereact/api'
import { SessionProvider } from 'next-auth/react'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
interface ClientLayoutProps {
  children: React.ReactNode
  recipes: Recipe[]
  isLoggedIn: boolean
  username: string | null
  avatarUrl?: string | null
}

export default function ClientLayout({ children, recipes, isLoggedIn, username, avatarUrl }: ClientLayoutProps) {
  const menuOptions = [
    {
      label: 'Recipes',
      to: '/recipes',
      children: [
        { label: 'Browse All Recipes', to: '/recipes' },
        { label: 'Add New Recipe', to: '/recipes/new' },
        ...recipes.map((recipe: Recipe) => ({
          label: recipe.name,
          to: `/recipes/${toSlug(recipe.name)}`,
        })),
      ],
    },
    {
      label: 'Foods',
      to: '/foods',
      children: [
        { label: 'Browse All Foods', to: '/foods' },
        { label: 'Add New Food', to: '/foods/new' },
      ],
    },
    {
      label: 'Pantry',
      to: '/pantry',
      children: [
        { label: 'Browse Pantry', to: '/pantry' },
        { label: 'Add Pantry Item', to: '/pantry/new' },
      ],
    },
    ...(isLoggedIn
      ? [
          { label: username ?? 'Profile', to: '/profile', align: 'right' as const, avatar: { url: avatarUrl ?? null, initial: (username ?? 'P').charAt(0).toUpperCase() } },
          { label: 'Logout', to: '/logout', align: 'right' as const },
        ]
      : [{ label: 'Login', to: '/login', align: 'right' as const }]),
  ]

  return (
     <SessionProvider>
      <PrimeReactProvider>
        <div className="app-shell">
          <ToolBar menuOptions={menuOptions} />
          <main className="page-content">
            {children}
          </main>
          <Analytics />
          <SpeedInsights />
        </div>
      </PrimeReactProvider>
     </SessionProvider>
  )
}
