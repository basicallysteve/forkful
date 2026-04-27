export type SignUpData = {
  username: string
  email: string
  password: string
}

export type SignUpResult = {
  id: string
  username: string
  email: string
}

export async function apiSignUp(data: SignUpData): Promise<SignUpResult> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Registration failed')
  }
  return res.json()
}
