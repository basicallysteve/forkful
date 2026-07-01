/**
 * Read a post-auth redirect target from the current URL's `callbackUrl` param.
 * Only same-site relative paths are honoured (guards against open redirects);
 * anything else falls back to the home page. Safe during SSR (returns '/').
 */
export function getCallbackUrl(): string {
  if (typeof window === 'undefined') return '/'
  const raw = new URLSearchParams(window.location.search).get('callbackUrl')
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
}
