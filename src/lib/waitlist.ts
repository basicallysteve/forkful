import crypto from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { waitlistEntries } from '@/db/schema'
import { taskRunner } from '@/lib/TaskRunner'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 100

export type JoinWaitlistInput = {
  email: string
  name?: string | null
  marketingEmailOptIn?: boolean
}

/** Waitlist emails are compared case-insensitively, so store them trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidWaitlistEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  return trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(trimmed)
}

/**
 * Adds an email to the Waitlist. Never creates a User. A duplicate (any casing) changes
 * nothing, including the opt-in. `created` tells the caller whether this was a new entry;
 * it must not be exposed to the visitor (see ADR-0032).
 */
export async function joinWaitlist(input: JoinWaitlistInput): Promise<{ created: boolean }> {
  const name = input.name?.trim().slice(0, MAX_NAME_LENGTH) || null
  const inserted = await taskRunner.run(
    () => db
      .insert(waitlistEntries)
      .values({
        email: normalizeEmail(input.email),
        name,
        marketingEmailOptIn: input.marketingEmailOptIn === true,
      })
      .onConflictDoNothing()
      .returning({ id: waitlistEntries.id }),
    'waitlist.join',
  )
  return { created: inserted.length > 0 }
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', authSecret()).update(`waitlist-leave:${payload}`).digest('base64url')
}

/** Signed, non-expiring token for the "leave the Waitlist" link. Carries the normalized email. */
export function signWaitlistLeaveToken(email: string): string {
  const payload = Buffer.from(normalizeEmail(email)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Returns the email the token was signed for, or null when it is malformed or tampered with. */
export function verifyWaitlistLeaveToken(token: string | undefined): string | null {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payload, signature] = parts
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null
  const email = Buffer.from(payload, 'base64url').toString('utf8')
  return email || null
}

/**
 * Removes the Waitlist Entry a leave token was signed for. Idempotent: a valid token for an
 * entry that is already gone still reports 'removed'. Never touches a User.
 */
export async function leaveWaitlist(token: string | undefined): Promise<'removed' | 'invalid'> {
  const email = verifyWaitlistLeaveToken(token)
  if (!email) return 'invalid'
  await taskRunner.run(
    () => db.delete(waitlistEntries).where(eq(sql`lower(${waitlistEntries.email})`, email)),
    'waitlist.leave',
  )
  return 'removed'
}
