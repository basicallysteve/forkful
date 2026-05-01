import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

// Define the routes you want to protect
const protectedRoutes = ['/recipes/new', '/foods/new', '/pantry', '/foods', '/recipes']

export async function middleware(request: NextRequest) {
  
  await redirectPrivateRoutes(request)

  let user = await getUserFromSession(request)

  let response =  NextResponse.next()

  if (user) {
    response.cookies.set('user', JSON.stringify({ id: user.id, username: user.username }), { httpOnly: false, secure: true, sameSite: 'strict' })
  } else {
    response.cookies.delete('user')
  }

  return response
}

async function redirectPrivateRoutes(request: NextRequest) {
    const path = request.nextUrl.pathname
    const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route))

    const sessionCookie = request.cookies.get('session')?.value
    const session = sessionCookie ? await decrypt(sessionCookie).catch(() => null) : null

    if (isProtectedRoute && !session?.userId) {
      return NextResponse.redirect(new URL('/login', request.nextUrl))
    }
}

async function getUserFromSession(request: NextRequest): Promise<{ id: string | number, username: string } | null> {
    const sessionCookie = request.cookies.get('session')?.value
    if (sessionCookie) {
      let session = await decrypt(sessionCookie) as any;
      if (session && session.expiresAt && new Date(session.expiresAt) > new Date()) {
        return { id: session.userId, username: session.username }
      }
    }
    return null
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}