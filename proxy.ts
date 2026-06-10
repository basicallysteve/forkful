import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require a logged-in session.
// Public browsing (/recipes, /foods, /foods/[slug]) stays accessible to all.
const PROTECTED_ROUTES = ['/pantry', '/profile', '/recipes/new', '/foods/new', '/foods/[slug]/edit']

export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route))

  if (isProtected) {
    // next-auth v5 JWT session cookies (dev uses plain name; prod uses __Secure- prefix)
    const hasSession =
      request.cookies.has('authjs.session-token') ||
      request.cookies.has('__Secure-authjs.session-token')

    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|jpg|ico|webp)$).*)'],
}
