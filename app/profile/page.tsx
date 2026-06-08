import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/session'
import { getUser } from '@/lib/users'
import Profile from '@/views/Profile/Profile'

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value

  if (!sessionCookie) redirect('/login')

  const session = await decrypt(sessionCookie).catch(() => null)
  const rawUserId = (session as { userId?: unknown } | null)?.userId
  const userId = Number(rawUserId)
  if (!session || !rawUserId || !Number.isInteger(userId) || userId <= 0) redirect('/login')
  const user = await getUser(userId)
  if (!user) redirect('/login')

  return <Profile user={user} />
}
