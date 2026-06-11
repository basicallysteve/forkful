import type { Metadata } from 'next'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: 'About',
  description: 'Forkful is a recipe manager, pantry tracker, and food log built for people who actually cook.',
  openGraph: {
    title: 'About Forkful',
    description: 'Forkful is a recipe manager, pantry tracker, and food log built for people who actually cook.',
    images: [{ url: '/og-default.png' }],
  },
}

export default function AboutPage() {
  return (
    <article className={styles.article}>
      <h1>About Forkful</h1>
      <p className={styles.lead}>
        Forkful is a recipe manager, pantry tracker, and food log — built for people who actually cook.
      </p>
      <p>
        Most recipe apps are built for browsing, not for cooking. Forkful is different. It&apos;s designed around the reality of a home kitchen: ingredients that expire, recipes you&apos;ve perfected, and a need to know what&apos;s actually in the fridge.
      </p>
      <h2>What you can do</h2>
      <ul>
        <li><strong>Recipes</strong> — create, save, and organise recipes with full nutritional breakdowns.</li>
        <li><strong>Pantry</strong> — track your stock and get alerts before things expire.</li>
        <li><strong>Food library</strong> — build a nutritional database from scratch or import from Open Food Facts.</li>
      </ul>
      <h2>Who built it</h2>
      <p>
        Forkful is an independent project, built and maintained by a single developer who got tired of keeping recipes in notes apps and spreadsheets.
      </p>
    </article>
  )
}
