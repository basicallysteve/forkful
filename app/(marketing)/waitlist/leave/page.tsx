import type { Metadata } from 'next'
import { leaveDeactivatesAccount, verifyWaitlistLeaveToken } from '@/lib/waitlist'
import WaitlistLeaveConfirm from '@/views/Waitlist/WaitlistLeaveConfirm'
import WaitlistLeaveView from '@/views/Waitlist/WaitlistLeaveView'

export const metadata: Metadata = {
  title: 'Leave the waitlist',
  robots: { index: false },
}

/**
 * A GET never removes anyone (email scanners prefetch links). A valid token shows a
 * confirmation button that POSTs the removal (and says so when that also deactivates an account); anything else shows "This link is invalid".
 */
export default async function WaitlistLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  const value = typeof token === 'string' ? token : undefined
  if (!value || !verifyWaitlistLeaveToken(value)) return <WaitlistLeaveView status="invalid" />
  return <WaitlistLeaveConfirm token={value} deactivates={await leaveDeactivatesAccount(value)} />
}
