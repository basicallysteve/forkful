#!/usr/bin/env bun
/**
 * Dev only: create (or replace) an Invite for an email in the forkful-dev database and print
 * its Invite Email link. Usage: bun seed:dev-invite -- --email someone@example.com
 * Refuses to run unless every database URL is forkful-dev.
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
const [{ sql }, { db }, { invites }, { createInvite }, { normalizeEmail }, { buildInviteLink }] = await Promise.all([
  import('drizzle-orm'), import('@/db'), import('@/db/schema'), import('@/lib/invites'), import('@/lib/waitlist'), import('@/lib/inviteLink'),
])

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
