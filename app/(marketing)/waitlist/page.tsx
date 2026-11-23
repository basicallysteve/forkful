import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import WaitlistForm from '@/views/Waitlist/WaitlistForm'
import styles from '@/views/Waitlist/Waitlist.module.scss'

export const metadata: Metadata = {
  title: 'Join the waitlist',
  description: 'EatForkful is invite-only for now. Join the waitlist and we will email you when your invite is ready.',
}

export default async function WaitlistPage() {
  // A signed-in user has no reason to join the waitlist. /waitlist/leave is deliberately not
  // redirected: an emailed leave link must work whether or not the person is logged in.
  if (await getSessionUser()) redirect('/')

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
