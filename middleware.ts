import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

type SessionPayload = { userId: string | number; username: string; expiresAt: string }

// Define the routes you want to protect
const protectedRoutes = ['/recipes/new', '/foods/new', '/pantry', '/foods', '/recipes']

export async function middleware(request: NextRequest) {
  const redirect = await redirectPrivateRoutes(request)
  if (redirect) return redirect

  const user = await getUserFromSession(request)
  const response = NextResponse.next()

  if (user) {
    response.cookies.set('user', JSON.stringify({ username: user.username }), { httpOnly: false, secure: true, sameSite: 'strict' })
  } else {
    response.cookies.delete('user')
  }

  return response
}

async function redirectPrivateRoutes(request: NextRequest): Promise<NextResponse | null> {
    const path = request.nextUrl.pathname
    const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route))

    const sessionCookie = request.cookies.get('session')?.value
    const session = sessionCookie ? await decrypt(sessionCookie).catch(() => null) : null

    if (isProtectedRoute && !(session as SessionPayload)?.userId) {
      return NextResponse.redirect(new URL('/login', request.nextUrl))
    }
    return null
}

async function getUserFromSession(request: NextRequest): Promise<{ id: string | number, username: string } | null> {
    const sessionCookie = request.cookies.get('session')?.value
    if (sessionCookie) {
      const session = await decrypt(sessionCookie) as SessionPayload;
      if (session && session.expiresAt && new Date(session.expiresAt) > new Date()) {
        return { id: session.userId, username: session.username }
      }
    }
    return null
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}