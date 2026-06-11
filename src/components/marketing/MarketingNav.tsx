import Link from 'next/link'
import styles from './MarketingNav.module.scss'

export default function MarketingNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.logo}>Forkful</Link>
      <nav className={styles.links}>
        <Link href="/about" className={styles.link}>About</Link>
        <Link href="/blog" className={styles.link}>Blog</Link>
        <Link href="/login" className={styles.linkSecondary}>Log in</Link>
        <Link href="/create-account" className={styles.cta}>Get started free</Link>
      </nav>
    </header>
  )
}
