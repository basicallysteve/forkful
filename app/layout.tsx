export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import ClientLayout from './ClientLayout'
import { getSessionUser } from '@/lib/auth'
import { getSiteUrl } from '@/lib/seo'
import 'primereact/resources/themes/lara-dark-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css';
import './globals.scss'


export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    template: '%s | EatForkful',
    default: 'EatForkful',
  },
  description: 'Recipes worth repeating',
  icons: {
    icon: '/forkful-favicon.svg',
  },
}

// Tells the browser (Safari's adaptive dark mode in particular) that the page themes itself
export const viewport: Viewport = {
  colorScheme: 'light dark',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getSessionUser (not auth()) so a signed-in user without an Invite gets the signed-out nav (ADR-0032).
  const session = await getSessionUser()
  const isLoggedIn = !!session
  const username = session?.username ?? null
  const avatarUrl = session?.avatarUrl ?? null

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevents flash of wrong theme by applying stored preference before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(_){}` }} />
      </head>
      <body>
        <ClientLayout isLoggedIn={isLoggedIn} username={username} avatarUrl={avatarUrl}>{children}</ClientLayout>
      </body>
    </html>
  )
}
