import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

type SessionPayload = { userId: string | number; username: string }

const protectedRoutes = ['/recipes/new', '/foods/new', '/pantry', '/foods', '/recipes']
const secure = process.env.NODE_ENV === 'production'

export async function proxy(request: NextRequest) {
  const session = await getSession(request)

  const redirect = redirectIfProtected(request, session)
  if (redirect) return redirect

  const response = NextResponse.next()
  if (session) {
    response.cookies.set('user', JSON.stringify({ username: session.username }), { httpOnly: false, secure, sameSite: 'strict' })
  } else {
    response.cookies.delete('user')
  }
  return response
}

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) return null
  return await decrypt(sessionCookie).catch(() => null) as SessionPayload | null
}

function redirectIfProtected(request: NextRequest, session: SessionPayload | null): NextResponse | null {
  const path = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route))
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }
  return null
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
