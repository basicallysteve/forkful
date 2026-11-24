import crypto from 'crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { invites, waitlistEntries } from '@/db/schema'
import type { User } from '@/types/User'
import { signUp } from '@/lib/users'
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

export type InviteRow = { id: number; codeHash: string; codeUsedAt: Date | null }

export async function getInviteByEmail(email: string): Promise<InviteRow | null> {
  const [row] = await db
    .select({ id: invites.id, codeHash: invites.codeHash, codeUsedAt: invites.codeUsedAt })
    .from(invites)
    .where(eq(sql`lower(${invites.email})`, normalizeEmail(email)))
  return row ?? null
}

export type SignUpWithInviteInput = {
  username: string
  email: string
  password: string
  cuisinePreferences: string[]
  dietaryRestrictions: string[]
  marketingEmailOptIn?: boolean
  code?: string
}

export type SignUpWithInviteResult = { status: 'created'; user: User } | { status: 'invalid-code' }

/**
 * Creates a User from an Invite's single-use code (ADR-0032). No invite, or a missing, wrong or
 * used code, all give 'invalid-code'. The code is redeemed by one conditional UPDATE in the
 * same transaction as the user insert: concurrent requests can't both win, and a failed insert
 * (taken username) leaves the code unused.
 */
export async function signUpWithInvite({ code, ...user }: SignUpWithInviteInput): Promise<SignUpWithInviteResult> {
  const invite = await getInviteByEmail(user.email)
  if (!invite || invite.codeUsedAt || !code || !inviteCodeMatchesHash(code, invite.codeHash)) {
    return { status: 'invalid-code' }
  }

  return taskRunner.run(
    () => db.transaction(async (tx): Promise<SignUpWithInviteResult> => {
      const redeemed = await tx
        .update(invites)
        .set({ codeUsedAt: new Date() })
        .where(and(eq(invites.id, invite.id), isNull(invites.codeUsedAt)))
        .returning({ id: invites.id })
      if (redeemed.length === 0) return { status: 'invalid-code' }
      return { status: 'created', user: await signUp(user, tx) }
    }),
    'invite.redeem',
  )
}
