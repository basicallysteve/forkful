import Link from 'next/link'
import styles from './MarketingFooter.module.scss'

export default function MarketingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.copy}>© {year} Forkful. Recipes worth repeating.</p>
        <nav className={styles.links} aria-label="Footer navigation">
          <Link href="/about" className={styles.link}>About</Link>
          <Link href="/blog" className={styles.link}>Blog</Link>
          <Link href="/terms" className={styles.link}>Terms</Link>
          <Link href="/login" className={styles.link}>Log in</Link>
          <Link href="/create-account" className={styles.link}>Sign up</Link>
        </nav>
      </div>
    </footer>
  )
}
