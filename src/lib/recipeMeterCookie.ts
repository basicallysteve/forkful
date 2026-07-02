/**
 * Signed-cookie codec for the Recipe View Limit meter.
 *
 * WHAT THIS DOES
 * We track how many recipes an anonymous visitor has viewed by storing that
 * count in a browser cookie. But a cookie lives on the visitor's machine, so
 * they could just edit it ("I've viewed 0 recipes") to dodge the Signup Wall.
 * To stop that, we don't only store the data — we also attach a signature
 * (an HMAC) computed with a secret only the server knows (AUTH_SECRET).
 *
 * - `signMeter` writes the cookie: it stores the data AND a signature.
 * - `readMeter` reads it back: it recomputes the signature and, if it doesn't
 *   match, rejects the cookie. Editing the data invalidates the signature, and
 *   the visitor can't produce a valid one without the server secret.
 *
 * The one thing they CAN do is delete the cookie, which just resets them to
 * zero views — an accepted trade-off (see ADR-0020).
 *
 * WHY IT'S WRITTEN THIS WAY
 * This runs inside Next.js middleware (the Edge runtime), which does not have
 * Node's `Buffer` or `crypto` module. So we use only web-standard APIs that
 * exist there: `crypto.subtle` for the HMAC, and `btoa`/`atob` for base64.
 */
import { type MeterPayload } from '@/lib/recipeMeter'

/** Cookie name holding the signed meter payload. */
export const RECIPE_METER_COOKIE = 'ff.recipe_meter'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Base64url is base64 that's safe to put in a cookie/URL: it swaps the `+` and
// `/` characters (which have special meaning there) for `-` and `_`, and drops
// the trailing `=` padding. These two helpers convert raw bytes <-> that text.
function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value: string): Uint8Array {
  // Undo the base64url substitutions and restore the `=` padding atob expects.
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Turn the plain-string AUTH_SECRET into a CryptoKey the Web Crypto API can use
// to sign and verify. Same secret in = same key out, which is what lets the
// server reproduce (and thus check) a signature it made earlier.
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * Build the cookie value for a payload: `<body>.<signature>`.
 * `body` is the JSON payload as base64url text; `signature` is the HMAC of that
 * body. Storing them together lets `readMeter` later re-check the body against
 * the signature.
 */
export async function signMeter(payload: MeterPayload, secret: string): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${b64urlEncode(new Uint8Array(signature))}`
}

/**
 * Read a meter cookie back into a payload. Returns null — meaning "treat this
 * visitor as brand new" — whenever the cookie is missing, malformed, or has
 * been tampered with (signature doesn't match). Callers never see forged data.
 */
export async function readMeter(raw: string | undefined, secret: string): Promise<MeterPayload | null> {
  if (!raw) return null

  // Split the `<body>.<signature>` shape; bail if either half is absent.
  const [body, signature] = raw.split('.')
  if (!body || !signature) return null

  // Everything below can throw on a corrupt cookie (e.g. non-base64 text). We
  // catch and return null so a bad cookie is ignored rather than crashing the
  // middleware — which would otherwise 500 every recipe page for that visitor.
  try {
    // Recompute the HMAC of the body and confirm it matches the signature the
    // cookie carries. If not, the cookie was altered — reject it.
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(signature) as BufferSource,
      encoder.encode(body),
    )
    if (!valid) return null

    // Signature checks out, so the body is genuine. Parse it and defensively
    // confirm it still has the shape we expect before trusting the fields.
    const parsed = JSON.parse(decoder.decode(b64urlDecode(body))) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as MeterPayload).periodStart !== 'number' ||
      !Array.isArray((parsed as MeterPayload).ids)
    ) {
      return null
    }
    const { periodStart, ids } = parsed as MeterPayload
    // Drop any non-string entries so downstream code only ever sees string IDs.
    return { periodStart, ids: ids.filter((id): id is string => typeof id === 'string') }
  } catch {
    return null
  }
}
