import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { invites, waitlistEntries } from '@/db/schema'
import { taskRunner } from '@/lib/TaskRunner'
import { logInfo } from '@/lib/logger'
import { normalizeEmail } from '@/lib/waitlist'

/**
 * Invite codes (ADR-0032): 256 random bits, URL-safe, shown to the admin flow once and never
 * stored. Only the SHA-256 hex of the code lives in `invites.code_hash`. A fast hash is fine
 * here because the code is high-entropy random, not a human-chosen secret.
 */
export function generateInviteCode(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/** Constant-time check of a presented code against a stored hash. */
export function inviteCodeMatchesHash(code: string, storedHash: string): boolean {
  if (!code || storedHash.length !== 64) return false
  const actual = Buffer.from(hashInviteCode(code))
  const expected = Buffer.from(storedHash)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export type CreateInviteInput = { entryId: number } | { email: string }

export type CreateInviteResult =
  | { status: 'created'; inviteId: number; email: string; code: string }
  | { status: 'already-invited' }
  | { status: 'entry-not-found' }

/**
 * Creates the Invite for an email, either from a Waitlist Entry or a typed address. Returns
 * the raw code once; callers must not log or store it. Never touches `users`.
 */
export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  let email: string
  if ('entryId' in input) {
    const [entry] = await db
      .select({ email: waitlistEntries.email })
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, input.entryId))
    if (!entry) return { status: 'entry-not-found' }
    email = normalizeEmail(entry.email)
  } else {
    email = normalizeEmail(input.email)
  }

  const code = generateInviteCode()
  const inserted = await taskRunner.run(
    () => db
      .insert(invites)
      .values({ email, codeHash: hashInviteCode(code) })
      .onConflictDoNothing()
      .returning({ id: invites.id }),
    'invite.create',
  )
  if (inserted.length === 0) return { status: 'already-invited' }
  logInfo('Invite created', { area: 'waitlist' })
  return { status: 'created', inviteId: inserted[0].id, email, code }
}

/** Removes an Invite. Returns false when it did not exist. Never touches `users`. */
export async function revokeInvite(id: number): Promise<boolean> {
  const removed = await taskRunner.run(
    () => db.delete(invites).where(eq(invites.id, id)).returning({ id: invites.id }),
    'invite.revoke',
  )
  if (removed.length > 0) logInfo('Invite revoked', { area: 'waitlist' })
  return removed.length > 0
}
