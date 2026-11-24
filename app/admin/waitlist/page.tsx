import { redirect } from 'next/navigation'
import { getSessionUser, isAdmin } from '@/lib/auth'
import AdminWaitlist from '@/views/Admin/AdminWaitlist'

export default async function AdminWaitlistPage() {
  const session = await getSessionUser()
  if (!session) redirect('/login')
  if (!isAdmin(session.userId)) redirect('/')

  // Only production sends invite emails (see src/lib/email.ts); elsewhere the page says so.
  return <AdminWaitlist emailsEnabled={process.env.VERCEL_ENV === 'production'} />
}
