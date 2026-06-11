import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import Welcome from '@/views/Welcome/Welcome'

export default async function WelcomePage() {
  const session = await getSessionUser()

  if (!session) redirect('/login')
  if (!session.needsOnboarding) redirect('/')

  return <Welcome />
}
