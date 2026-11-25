import crypto from 'crypto'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { invites, users, waitlistEntries } from '@/db/schema'
import { taskRunner } from '@/lib/TaskRunner'
import { deactivateAccount } from '@/lib/users'

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
 * The active User the leave link would deactivate: a User with this email, no Invite, and not
 * the admin (the waitlist notice, #329, goes to exactly these accounts). Null for a plain
 * Waitlist Entry, an invited User, or an account that is already deactivated.
 */
async function findLeavingAccount(email: string): Promise<number | null> {
  const adminId = process.env.ADMIN_USER_ID
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(sql`lower(${users.email})`, email),
      isNull(users.dateDeleted),
      adminId ? ne(users.id, Number(adminId)) : undefined,
      sql`not exists (select 1 from ${invites} where lower(${invites.email}) = lower(${users.email}))`,
    ))
    .limit(1)
  return user?.id ?? null
}

/** True when a valid leave token would also deactivate an account, so the page can say so first. */
export async function leaveDeactivatesAccount(token: string | undefined): Promise<boolean> {
  const email = verifyWaitlistLeaveToken(token)
  return email ? (await findLeavingAccount(email)) !== null : false
}

/**
 * Removes the Waitlist Entry a leave token was signed for and, when the email belongs to a
 * Waitlisted User (no Invite), deactivates that account with the usual Account Deactivation
 * (ADR-0007). Idempotent: a valid token for an entry that is already gone still reports 'removed'.
 */
export async function leaveWaitlist(token: string | undefined): Promise<'removed' | 'invalid'> {
  const email = verifyWaitlistLeaveToken(token)
  if (!email) return 'invalid'
  await taskRunner.run(
    () => db.delete(waitlistEntries).where(eq(sql`lower(${waitlistEntries.email})`, email)),
    'waitlist.leave',
  )
  const userId = await findLeavingAccount(email)
  if (userId !== null) await taskRunner.run(() => deactivateAccount(userId), 'waitlist.leave-deactivate')
  return 'removed'
}

export type WaitlistAdminEntry = {
  /** Null for an Invite created for an email that is not on the Waitlist. */
  entryId: number | null
  email: string
  name: string | null
  marketingEmailOptIn: boolean
  dateAdded: Date
  /** The Invite's id when one exists (used to revoke); the code hash is never returned. */
  inviteId: number | null
  invited: boolean
  /** A `users` row exists with this email. */
  hasAccount: boolean
}

/**
 * Admin list, newest first: every Waitlist Entry plus every Invite whose email is not on the
 * Waitlist (entry-less rows). An email that is on both appears once, as the entry. Emails match
 * case-insensitively.
 */
export async function listWaitlist(): Promise<WaitlistAdminEntry[]> {
  const rows = await db
    .select({
      entryId: waitlistEntries.id,
      email: waitlistEntries.email,
      name: waitlistEntries.name,
      marketingEmailOptIn: waitlistEntries.marketingEmailOptIn,
      dateAdded: waitlistEntries.dateAdded,
      inviteId: sql<number | null>`(select i.id from ${invites} i where lower(i.email) = lower(waitlist_entries.email) limit 1)`,
      hasAccount: sql<boolean>`exists (select 1 from ${users} u where lower(u.email) = lower(waitlist_entries.email))`,
    })
    .from(waitlistEntries)
    .orderBy(desc(waitlistEntries.dateAdded), desc(waitlistEntries.id))
  const entries: WaitlistAdminEntry[] = rows.map((r) => ({ ...r, invited: r.inviteId !== null }))

  const inviteOnly = await db
    .select({
      email: invites.email,
      dateAdded: invites.dateAdded,
      inviteId: invites.id,
      hasAccount: sql<boolean>`exists (select 1 from ${users} u where lower(u.email) = lower(invites.email))`,
    })
    .from(invites)
    .where(sql`not exists (select 1 from ${waitlistEntries} w where lower(w.email) = lower(invites.email))`)
  const detached: WaitlistAdminEntry[] = inviteOnly.map((r) => ({
    ...r, entryId: null, name: null, marketingEmailOptIn: false, invited: true,
  }))

  return [...entries, ...detached].sort((a, b) => b.dateAdded.getTime() - a.dateAdded.getTime())
}

/** Admin removal of a Waitlist Entry. Returns false when it did not exist. Never touches a User or an Invite. */
export async function deleteWaitlistEntry(id: number): Promise<boolean> {
  const removed = await taskRunner.run(
    () => db.delete(waitlistEntries).where(eq(waitlistEntries.id, id)).returning({ id: waitlistEntries.id }),
    'waitlist.admin-delete',
  )
  return removed.length > 0
}
