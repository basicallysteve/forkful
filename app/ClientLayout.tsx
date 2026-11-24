'use client'

import ToolBar from '@/components/ToolBar'
import MarketingNav from '@/components/marketing/MarketingNav'
import MarketingFooter from '@/components/marketing/MarketingFooter'
import { InviteOnlyProvider } from '@/components/InviteOnlyProvider'
import { PrimeReactProvider } from 'primereact/api'
import { SessionProvider } from 'next-auth/react'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

interface ClientLayoutProps {
  children: React.ReactNode
  isLoggedIn: boolean
  username: string | null
  avatarUrl?: string | null
  /** The `invite-only-access` flag, decided server-side in the root layout. */
  inviteOnly: boolean
}

export default function ClientLayout({ children, isLoggedIn, username, avatarUrl, inviteOnly }: ClientLayoutProps) {
  const isMarketingShell = !isLoggedIn

  const menuOptions = [
    {
      label: 'Recipes',
      to: '/recipes',
    },
    {
      label: 'Pantry',
      to: '/pantry',
      children: [
        { label: 'Browse Pantry', to: '/pantry' },
        { label: 'Add Pantry Item', to: '/pantry/new' },
      ],
    },
    {
      label: 'Shopping List',
      to: '/shopping-list',
    },
    {
      label: 'Log',
      to: '/log',
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
      <InviteOnlyProvider value={inviteOnly}>
      <SessionProvider session={null}>
        <div className="marketing-shell">
          <MarketingNav />
          <main>{children}</main>
          <MarketingFooter />
          <Analytics />
          <SpeedInsights />
        </div>
      </SessionProvider>
      </InviteOnlyProvider>
    )
  }

  return (
     <InviteOnlyProvider value={inviteOnly}>
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
     </InviteOnlyProvider>
  )
}
