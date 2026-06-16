import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getOpenReports } from '@/lib/reviews'
import AdminReports from '@/views/Admin/AdminReports'

export default async function AdminReportsPage() {
  const session = await getSessionUser()
  if (!session) redirect('/login')

  const adminId = process.env.ADMIN_USER_ID
  if (!adminId || session.userId !== Number(adminId)) redirect('/')

  const reports = await getOpenReports()

  return <AdminReports initialReports={reports} />
}
