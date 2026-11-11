/**
 * Read a post-auth redirect target from the current URL's `callbackUrl` param.
 * Only same-site relative paths are honoured (guards against open redirects);
 * anything else falls back to the home page. Safe during SSR (returns '/').
 */
export function getCallbackUrl(): string {
  if (typeof window === 'undefined') return '/'
  const raw = new URLSearchParams(window.location.search).get('callbackUrl')
  return isSafeCallbackUrl(raw) ? raw : '/'
}

/**
 * A callbackUrl is safe only if it's a same-site relative path. Reject
 * protocol-relative (`//host`) and — because browsers normalise `\` to `/` —
 * any value containing a backslash (`/\host` would otherwise become `//host`).
 */
function isSafeCallbackUrl(raw: string | null): raw is string {
  return (
    raw !== null &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.includes('\\')
  )
}
