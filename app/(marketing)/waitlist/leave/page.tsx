import type { Metadata } from 'next'
import { leaveWaitlist } from '@/lib/waitlist'
import WaitlistLeaveView from '@/views/Waitlist/WaitlistLeaveView'

export const metadata: Metadata = {
  title: 'Leave the waitlist',
  robots: { index: false },
}

export default async function WaitlistLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  const value = typeof token === 'string' ? token : undefined
  const status = value ? await leaveWaitlist(value) : 'invalid'
  return <WaitlistLeaveView status={status} />
}
