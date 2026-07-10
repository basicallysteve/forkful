// URL Fetch Guard — defends the URL Recipe Import scrape against server-side request
// forgery by refusing to fetch internal targets. See ADR-0023.
//
// This is a static host denylist; it does NOT defend against DNS rebinding or public
// hostnames that resolve to private IPs. If the scrape endpoint is ever opened to
// untrusted or high-volume use, upgrade to DNS-resolution pinning (see ADR-0023).

export const FETCH_TIMEOUT_MS = 10_000
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '0.0.0.0') return true

  // IPv4 loopback / private / link-local ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [, a, b] = v4.map(Number)
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 10) return true // 10.0.0.0/8
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (incl. cloud metadata)
  }

  return false
}

/**
 * Validates a user-supplied URL before the server fetches it. Returns the parsed URL when
 * safe, or throws with a user-facing message when the target is disallowed.
 */
export function assertFetchableUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('That URL is not allowed')
  }

  return url
}
