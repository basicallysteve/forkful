export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import ClientLayout from './ClientLayout'
import { auth } from '@/auth'
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
  const session = await auth()
  const isLoggedIn = !!session?.user
  const username = session?.user?.name ?? null
  const avatarUrl = session?.user?.image ?? null

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
