import type { Metadata } from 'next'
import WaitlistForm from '@/views/Waitlist/WaitlistForm'
import styles from '@/views/Waitlist/Waitlist.module.scss'

export const metadata: Metadata = {
  title: 'Join the waitlist',
  description: 'EatForkful is invite-only for now. Join the waitlist and we will email you when your invite is ready.',
}

export default function WaitlistPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Join the waitlist</h1>
      <p className={styles.lead}>
        EatForkful is invite-only for now. Leave your email and we&apos;ll send your invite when it&apos;s ready.
      </p>
      <WaitlistForm />
    </div>
  )
}
