'use client'

import ToolBar from '@/components/ToolBar'
import MarketingNav from '@/components/marketing/MarketingNav'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'
import { PrimeReactProvider } from 'primereact/api'
import { SessionProvider } from 'next-auth/react'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { usePathname } from 'next/navigation'

interface ClientLayoutProps {
  children: React.ReactNode
  recipes: Recipe[]
  isLoggedIn: boolean
  username: string | null
  avatarUrl?: string | null
}

const MARKETING_PATHS = ['/about', '/blog', '/login', '/create-account']

export default function ClientLayout({ children, recipes, isLoggedIn, username, avatarUrl }: ClientLayoutProps) {
  const pathname = usePathname()
  const isMarketingShell = !isLoggedIn && (
    pathname === '/' ||
    MARKETING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  )

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

  if (isMarketingShell) {
    return (
      <SessionProvider>
        <div className="marketing-shell">
          <MarketingNav />
          <main>{children}</main>
          <Analytics />
          <SpeedInsights />
        </div>
      </SessionProvider>
    )
  }

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
