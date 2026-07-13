// URL Fetch Guard — defends the URL Recipe Import scrape against server-side request
// forgery by refusing to fetch internal targets. See ADR-0023.
//
// This is a static host denylist; it does NOT defend against DNS rebinding or public
// hostnames that resolve to private IPs. If the scrape endpoint is ever opened to
// untrusted or high-volume use, upgrade to DNS-resolution pinning (see ADR-0023).

export const FETCH_TIMEOUT_MS = 10_000
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_REDIRECTS = 5

// Loopback / private / link-local IPv4 ranges. Takes the first two octets — enough to
// classify every range we block.
function isBlockedIPv4(a: number, b: number): boolean {
  if (a === 0) return true // 0.0.0.0/8 (incl. the "this host" 0.0.0.0)
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (incl. cloud metadata)
  return false
}

// Parse an IPv6 literal (with `::` compression and optional embedded IPv4) into its 8
// 16-bit groups, or null if it isn't a well-formed IPv6 address. Lets us classify
// IPv4-mapped/-compatible forms and IPv6 private ranges rather than only matching `::1`.
function parseIPv6(host: string): number[] | null {
  if (!host.includes(':')) return null

  let text = host
  // Fold a trailing embedded IPv4 (e.g. "::ffff:169.254.169.254") into two hextets so the
  // rest of the parser only deals with hex groups.
  const embeddedV4 = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (embeddedV4) {
    const octets = embeddedV4.slice(1).map(Number)
    if (octets.some((n) => n > 255)) return null
    const [a, b, c, d] = octets
    text = text.slice(0, embeddedV4.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const parseGroups = (s: string): number[] | null => {
    if (s === '') return []
    const out: number[] = []
    for (const part of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null
      out.push(parseInt(part, 16))
    }
    return out
  }

  const head = parseGroups(halves[0])
  const tail = halves.length === 2 ? parseGroups(halves[1]) : []
  if (head === null || tail === null) return null

  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length
    if (fill < 0) return null
    return [...head, ...Array<number>(fill).fill(0), ...tail]
  }
  return head.length === 8 ? head : null
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  if (host === 'localhost' || host.endsWith('.localhost')) return true

  // IPv4 loopback / private / link-local ranges. WHATWG URL normalises decimal/hex/octal
  // forms (e.g. 2130706433, 0x7f000001) to dotted-quad, so this catches those too.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [, a, b] = v4.map(Number)
    return isBlockedIPv4(a, b)
  }

  const v6 = parseIPv6(host)
  if (v6) {
    if (v6.every((g) => g === 0)) return true // :: unspecified
    if (v6.slice(0, 7).every((g) => g === 0) && v6[7] === 1) return true // ::1 loopback

    // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d) — both let an
    // IPv4 target ride in inside an IPv6 literal, so re-classify the embedded IPv4.
    const mapped = v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff
    const compatible = v6.slice(0, 6).every((g) => g === 0)
    if (mapped || compatible) {
      return isBlockedIPv4(v6[6] >> 8, v6[6] & 0xff)
    }

    if ((v6[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
    if ((v6[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
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
