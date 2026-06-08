export type SignUpData = {
  username: string
  email: string
  password: string
  cuisinePreferences: string[]
  dietaryRestrictions: string[]
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

type LoginData = {
  username: string
  password: string
}

export async function apiLogin(data: LoginData): Promise<{ username: string; email: string }> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Login failed')
  }

  return res.json()
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
  })
}

async function patchUser(userId: string | number, body: object): Promise<void> {
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Update failed')
  }
}

export async function apiUpdatePreferences(userId: string | number, cuisinePreferences: string[], dietaryRestrictions: string[]): Promise<void> {
  return patchUser(userId, { action: 'preferences', cuisinePreferences, dietaryRestrictions })
}

export async function apiUpdateEmail(userId: string | number, email: string): Promise<void> {
  return patchUser(userId, { action: 'email', email })
}

export async function apiUpdatePassword(userId: string | number, currentPassword: string, newPassword: string): Promise<void> {
  return patchUser(userId, { action: 'password', currentPassword, newPassword })
}