import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const secure = process.env.NODE_ENV === 'production'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set('session', '', { httpOnly: true, secure, sameSite: 'strict', expires: new Date(0) })
  return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
}
