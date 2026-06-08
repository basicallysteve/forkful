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
  if (!session || typeof (session as { userId?: unknown }).userId !== 'number') redirect('/login')

  const userId = (session as { userId: number }).userId
  const user = await getUser(userId)
  if (!user) redirect('/login')

  return <Profile user={user} />
}
