/**
 * Extracts the client IP from request headers.
 *
 * x-forwarded-for is a comma-separated list added by proxies: "client, proxy1, proxy2".
 * The first (leftmost) entry is the original client IP as reported by the first proxy.
 * This is the standard interpretation for CDN/proxy deployments (Vercel, Cloudflare, etc.).
 *
 * Note: x-forwarded-for can be spoofed when the app is not behind a trusted proxy.
 * For high-security deployments, configure your proxy to strip and re-set this header.
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
