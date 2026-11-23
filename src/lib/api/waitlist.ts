export type JoinWaitlistData = {
  email: string
  name: string
  marketingEmailOptIn: boolean
}

/** Joins the Waitlist. Throws an Error carrying the server's message when it rejects the input. */
export async function apiJoinWaitlist(data: JoinWaitlistData): Promise<void> {
  const fallback = 'Something went wrong. Please try again.'
  const res = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  }).catch(() => {
    throw new Error(fallback)
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? fallback)
  }
}
