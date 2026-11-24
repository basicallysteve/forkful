#!/usr/bin/env bun
/**
 * Dev only: create an Invite for an email in the forkful-dev database, so the test account
 * has access under the invite-only lock and QA has a fresh Invite Email link to open.
 *
 * Usage: bun seed:dev-invite -- --email someone@example.com
 *
 * Re-runnable: an existing Invite for the email is replaced, so a new link (with a new
 * single-use code) is always printed. Refuses to run unless the database is forkful-dev.
 * The printed link carries the raw code, which exists nowhere else; it is a dev-only secret.
 */
import { parseArgs } from 'node:util'
import { assertDevDatabase } from './devInviteSeed'

assertDevDatabase(process.env)

const { values } = parseArgs({ args: process.argv.slice(2), options: { email: { type: 'string' } } })
if (!values.email) {
  console.error('Usage: bun seed:dev-invite -- --email someone@example.com')
  process.exit(1)
}

// Imported after the guard: '@/db' connects on import.
const { sql } = await import('drizzle-orm')
const { db } = await import('@/db')
const { invites } = await import('@/db/schema')
const { createInvite } = await import('@/lib/invites')
const { normalizeEmail } = await import('@/lib/waitlist')
const { buildInviteLink } = await import('@/lib/inviteLink')

const email = normalizeEmail(values.email)
await db.delete(invites).where(sql`lower(${invites.email}) = ${email}`)
const result = await createInvite({ email })
if (result.status !== 'created') {
  console.error(`Could not create an Invite (${result.status}).`)
  process.exit(1)
}
console.log(`Invite created for ${email}`)
console.log(`Link: ${buildInviteLink(email, result.code)}`)
process.exit(0)
