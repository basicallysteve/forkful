import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that require a logged-in session.
// Public browsing (/recipes, /foods, /foods/[slug]) stays accessible to all.
const PROTECTED_ROUTES = ['/pantry', '/profile', '/recipes/new', '/foods/new', '/foods/[slug]/edit']

// Routes exempt from the 90-day password reset redirect.
const RESET_EXEMPT_PREFIXES = ['/reset-password', '/forgot-password', '/login', '/api/auth', '/logout']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const hasSessionCookie =
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')

  // Gate /reset-password: allow only if a valid ?token= is present (email flow)
  // or the session carries needsPasswordReset: true (90-day forced flow).
  // Without one of these, the page makes no sense and we send them to /login.
  if (pathname.startsWith('/reset-password')) {
    if (!request.nextUrl.searchParams.has('token')) {
      if (!hasSessionCookie) {
        return NextResponse.redirect(new URL('/login', request.nextUrl))
      }
      const jwtToken = await getToken({ req: request, secret: process.env.AUTH_SECRET })
      if (!jwtToken?.needsPasswordReset) {
        return NextResponse.redirect(new URL('/login', request.nextUrl))
      }
    }
    // Valid token param or forced-reset session — allow through.
    return NextResponse.next()
  }

  // Redirect sessions with expired passwords — runs before the protected-route check
  // so that even public pages force the reset if the user is logged in.
  const isResetExempt = RESET_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
  if (!isResetExempt && hasSessionCookie) {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
    if (token?.needsPasswordReset) {
      return NextResponse.redirect(new URL('/reset-password', request.nextUrl))
    }
  }

  // Protected routes: require an active session cookie.
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  if (isProtected && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|jpg|ico|webp)$).*)'],
}
