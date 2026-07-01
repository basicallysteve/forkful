/**
 * Signed-cookie codec for the Recipe View Limit meter.
 *
 * Edge-safe: uses Web Crypto (`crypto.subtle`) and `btoa`/`atob`, both available
 * in the middleware Edge runtime. The cookie is HMAC-signed with AUTH_SECRET so a
 * client cannot forge or tamper with the viewed-set — clearing it merely resets
 * the visitor to zero views (an accepted bypass, see ADR-0020).
 */
import { type MeterPayload } from '@/lib/recipeMeter'

/** Cookie name holding the signed meter payload. */
export const RECIPE_METER_COOKIE = 'ff.recipe_meter'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Serialize a payload to a `<body>.<signature>` cookie string. */
export async function signMeter(payload: MeterPayload, secret: string): Promise<string> {
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body))
  return `${body}.${b64urlEncode(new Uint8Array(signature))}`
}

/**
 * Verify and parse a meter cookie. Returns null for a missing, malformed, or
 * tampered cookie — callers then treat the visitor as fresh.
 */
export async function readMeter(raw: string | undefined, secret: string): Promise<MeterPayload | null> {
  if (!raw) return null
  const [body, signature] = raw.split('.')
  if (!body || !signature) return null

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    b64urlDecode(signature) as BufferSource,
    encoder.encode(body),
  )
  if (!valid) return null

  try {
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
    return { periodStart, ids: ids.filter((id): id is string => typeof id === 'string') }
  } catch {
    return null
  }
}
