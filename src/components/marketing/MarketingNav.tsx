import Link from 'next/link'
import styles from './MarketingNav.module.scss'
import ThemedLogo from '../ThemedLogo'
import SignupCta from '@/components/SignupCta/SignupCta'

export default function MarketingNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.logo}>
        <ThemedLogo size={36} />
        <span>EatForkful</span>
      </Link>
      <nav className={styles.links} aria-label="Marketing navigation">
        <Link href="/about" className={styles.link}>About</Link>
        <Link href="/blog" className={styles.link}>Blog</Link>
        <Link href="/login" className={styles.linkSecondary}>Log in</Link>
        <SignupCta className={styles.cta} openLabel="Get started free" />
      </nav>
    </header>
  )
}
