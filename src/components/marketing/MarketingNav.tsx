import Link from 'next/link'
import Image from 'next/image'
import styles from './MarketingNav.module.scss'

export default function MarketingNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.logo}>
        <Image src="/forkful-logo.svg" alt="Forkful" width={36} height={36} priority />
        <span>Forkful</span>
      </Link>
      <nav className={styles.links}>
        <Link href="/about" className={styles.link}>About</Link>
        <Link href="/blog" className={styles.link}>Blog</Link>
        <Link href="/login" className={styles.linkSecondary}>Log in</Link>
        <Link href="/create-account" className={styles.cta}>Get started free</Link>
      </nav>
    </header>
  )
}
