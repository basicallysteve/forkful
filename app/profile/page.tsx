import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getUser } from '@/lib/users'
import Profile from '@/views/Profile/Profile'

export default async function ProfilePage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect('/login')

  const user = await getUser(sessionUser.userId)
  if (!user) redirect('/login')

  return <Profile user={user} />
}
