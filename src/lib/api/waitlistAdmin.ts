import { ForbiddenError, UnauthorizedError } from '@/lib/api/errors'

export type WaitlistAdminRow = {
  /** Null for an Invite whose email is not on the Waitlist. */
  entryId: number | null
  email: string
  name: string | null
  marketingEmailOptIn: boolean
  dateAdded: string
  inviteId: number | null
  invited: boolean
  hasAccount: boolean
}

export type InviteResult =
  | { status: 'created'; inviteId: number; email: string; code: string; emailSent?: boolean }
  | { status: 'already-invited' }

const FALLBACK = 'Something went wrong. Please try again.'

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { credentials: 'same-origin', ...init }).catch(() => {
    throw new Error(FALLBACK)
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (res.status === 403) throw new ForbiddenError()
  return res
}

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error ?? FALLBACK)
}

export async function apiListWaitlist(): Promise<WaitlistAdminRow[]> {
  const res = await request('/api/admin/waitlist')
  if (!res.ok) return fail(res)
  return res.json()
}

/** Creates an Invite. The raw code is in the result once; the caller must not store or log it. */
export async function apiInvite(target: { entryId: number } | { email: string }): Promise<InviteResult> {
  const res = await request('/api/admin/waitlist/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  })
  if (res.status === 409) return { status: 'already-invited' }
  if (!res.ok) return fail(res)
  return { status: 'created', ...(await res.json()) }
}

/** Sends the one-time waitlist notice to Waitlisted Users who haven't had it. */
export async function apiSendWaitlistNotice(): Promise<{ sent: number; failed: number }> {
  const res = await request('/api/admin/waitlist/notice', { method: 'POST' })
  if (!res.ok) return fail(res)
  return res.json()
}

export async function apiRevokeInvite(inviteId: number): Promise<void> {
  const res = await request(`/api/admin/waitlist/invites/${inviteId}`, { method: 'DELETE' })
  if (!res.ok) return fail(res)
}

export async function apiDeleteWaitlistEntry(entryId: number): Promise<void> {
  const res = await request(`/api/admin/waitlist/entries/${entryId}`, { method: 'DELETE' })
  if (!res.ok) return fail(res)
}
