import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isbot } from 'isbot'
import { hasUnlimitedRecipeAccess } from '@/lib/entitlements'
import { decideMeter } from '@/lib/recipeMeter'
import { readMeter, signMeter, RECIPE_METER_COOKIE } from '@/lib/recipeMeterCookie'

/** Matches a Recipe detail page: /recipes/<shortId>/<slug> (not /recipes/new). */
const RECIPE_DETAIL_RE = /^\/recipes\/([^/]+)\/([^/]+)\/?$/

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

/**
 * Recipe View Limit metering (Signup Wall).
 *
 * Runs only on GET requests to a Recipe detail page. Exempt viewers — those with
 * Unlimited Recipe Access (logged-in) and known crawlers — pass through untouched.
 * For an Anonymous Visitor, evaluates the signed meter cookie, writes the updated
 * cookie, and forwards the gate decision to the Server Component via the
 * `x-recipe-gated` request header (always set authoritatively, overriding any
 * client-supplied value). Returns null when metering does not apply.
 */
async function meterRecipeView(
  request: NextRequest,
  pathname: string,
  hasSessionCookie: boolean,
): Promise<NextResponse | null> {
  if (request.method !== 'GET') return null

  const match = pathname.match(RECIPE_DETAIL_RE)
  if (!match) return null
  const shortId = match[1]

  // Entitlement is decided against a *verified* session, not mere cookie
  // presence — a stale or forged session cookie must not grant Unlimited
  // Recipe Access and silently bypass the meter.
  const isAuthenticated = hasSessionCookie
    ? (await getToken({ req: request, secret: process.env.AUTH_SECRET })) !== null
    : false
  if (hasUnlimitedRecipeAccess({ isAuthenticated })) return null
  if (isbot(request.headers.get('user-agent') ?? '')) return null

  // Without a real secret the HMAC key would be guessable and meter cookies
  // forgeable. Rather than sign with an empty key, skip metering entirely — a
  // misconfigured environment fails open (no wall) instead of insecurely.
  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  const payload = await readMeter(request.cookies.get(RECIPE_METER_COOKIE)?.value, secret)
  const { gated, nextPayload } = decideMeter(payload, shortId, Date.now())

  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set('x-recipe-gated', gated ? '1' : '0')

  const response = NextResponse.next({ request: { headers: forwardedHeaders } })
  response.cookies.set(RECIPE_METER_COOKIE, await signMeter(nextPayload, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 40, // 40 days — comfortably longer than the 30-day window
  })
  return response
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

  const meteredResponse = await meterRecipeView(request, pathname, hasSessionCookie)
  if (meteredResponse) return meteredResponse

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|svg|jpg|ico|webp)$).*)'],
}
