import { signOut } from '@/auth'

export async function POST() {
  await signOut({ redirect: false })
  return new Response(JSON.stringify({ message: 'Logged out successfully' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
