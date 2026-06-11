import type { Metadata } from 'next'
import styles from './layout.module.scss'

export const metadata: Metadata = {
  title: {
    template: '%s | Forkful',
    default: 'Forkful',
  },
  description: 'Recipes worth repeating.',
  openGraph: {
    siteName: 'Forkful',
    images: [{ url: '/og-default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      {children}
    </div>
  )
}
