import Link from 'next/link'
import styles from './Waitlist.module.scss'

export default function WaitlistLeaveView({ status }: { status: 'removed' | 'invalid' }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        {status === 'removed' ? "You've been removed from the waitlist" : 'This link is invalid'}
      </h1>
      <p className={styles.lead}>
        {status === 'removed'
          ? "We've deleted your email from the list and won't send you anything more about it."
          : 'It may have been copied incompletely. Open the link from your email again.'}
      </p>
      <Link href="/" className="ghost-button">Back to EatForkful</Link>
    </div>
  )
}
