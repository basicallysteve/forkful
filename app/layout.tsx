export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import ClientLayout from './ClientLayout'
import { getRecipes } from '@/lib/recipes'
import { decrypt } from '@/lib/session'
import type { Recipe } from '@/types/Recipe'
import 'primereact/resources/themes/lara-dark-blue/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css';
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
  let username: string | null = null
  let avatarUrl: string | null = null
  if (sessionCookie) {
    const session = await decrypt(sessionCookie).catch(() => null)
    if (session) {
      isLoggedIn = true
      const s = session as { username?: string; avatarUrl?: string | null }
      username = s.username ?? null
      avatarUrl = s.avatarUrl ?? null
    }
  }

  return (
    <html lang="en">
      <head>
        {/* Prevents flash of wrong theme by applying stored preference before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(_){}` }} />
      </head>
      <body>
        <ClientLayout recipes={recipes} isLoggedIn={isLoggedIn} username={username} avatarUrl={avatarUrl}>{children}</ClientLayout>
      </body>
    </html>
  )
}
