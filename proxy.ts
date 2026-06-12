import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that require a logged-in session.
// Public browsing (/recipes, /foods, /foods/[slug]) stays accessible to all.
const PROTECTED_ROUTES = ['/pantry', '/profile', '/recipes/new', '/foods', '/foods/[slug]', '/foods/new', '/foods/[slug]/edit']

// Routes exempt from the 90-day password reset redirect.
const RESET_EXEMPT_PREFIXES = ['/reset-password', '/forgot-password', '/login', '/api/auth', '/logout']

/** True when the incoming request carries any recognised session cookie. */
function detectSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')
  )
}

/**
 * Gate for /reset-password:
 * - A valid ?token= query param (email-link flow) is always allowed through.
 * - Otherwise the session must carry needsPasswordReset: true (90-day forced flow).
 * Returns a redirect response when access should be denied, null when it's fine.
 */
async function checkResetPasswordAccess(
  request: NextRequest,
  hasSessionCookie: boolean,
): Promise<NextResponse | null> {
  if (request.nextUrl.searchParams.has('token')) return null

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
  if (!token?.needsPasswordReset) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  return null
}

/**
 * If the authenticated user's password has expired (needsPasswordReset: true),
 * redirect them to /reset-password — unless they are already on an exempt path.
 * Returns a redirect response, or null if no redirect is needed.
 */
async function checkPasswordExpiryRedirect(
  request: NextRequest,
  pathname: string,
  hasSessionCookie: boolean,
): Promise<NextResponse | null> {
  const isExempt = RESET_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
  if (isExempt || !hasSessionCookie) return null

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
  if (token?.needsPasswordReset) {
    return NextResponse.redirect(new URL('/reset-password', request.nextUrl))
  }

  return null
}

/**
 * Protect routes that require an active session.
 * Returns a redirect to /login when the route is protected and no session cookie
 * is present, null otherwise.
 */
function checkProtectedRoute(
  request: NextRequest,
  pathname: string,
  hasSessionCookie: boolean,
): NextResponse | null {
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  if (isProtected && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }
  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSessionCookie = detectSessionCookie(request)

  if (pathname.startsWith('/reset-password')) {
    const redirect = await checkResetPasswordAccess(request, hasSessionCookie)
    return redirect ?? NextResponse.next()
  }

  const expiryRedirect = await checkPasswordExpiryRedirect(request, pathname, hasSessionCookie)
  if (expiryRedirect) return expiryRedirect

  const protectedRedirect = checkProtectedRoute(request, pathname, hasSessionCookie)
  if (protectedRedirect) return protectedRedirect

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|jpg|ico|webp)$).*)'],
}
