import type { Metadata } from 'next'
import ClientLayout from './ClientLayout'
import './globals.scss'

export const metadata: Metadata = {
  title: 'Forkful',
  description: 'Recipes worth repeating',
  icons: {
    icon: '/forkful-favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
