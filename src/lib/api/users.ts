import type { RecipeSuggestionFrequency, PantryExpirationFrequency } from '@/types/User'

export type SignUpData = {
  username: string
  email: string
  password: string
  cuisinePreferences: string[]
  dietaryRestrictions: string[]
  marketingEmailOptIn?: boolean
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

export async function apiUpdateUsername(userId: string | number, username: string): Promise<void> {
  return patchUser(userId, { action: 'username', username })
}

export async function apiUpdateEmailPreferences(userId: string | number, data: {
  marketingEmailOptIn: boolean
  recipeSuggestionFrequency: RecipeSuggestionFrequency
  pantryExpirationFrequency: PantryExpirationFrequency
}): Promise<void> {
  return patchUser(userId, { action: 'emailPreferences', ...data })
}

export async function apiUpdateEmail(userId: string | number, email: string): Promise<void> {
  return patchUser(userId, { action: 'email', email })
}

export async function apiUpdatePassword(userId: string | number, currentPassword: string, newPassword: string): Promise<void> {
  return patchUser(userId, { action: 'password', currentPassword, newPassword })
}

export async function apiDeactivateAccount(userId: string | number): Promise<void> {
  return patchUser(userId, { action: 'deactivate' })
}

export async function apiDeleteAccount(userId: string | number): Promise<void> {
  return patchUser(userId, { action: 'delete' })
}

export async function apiSubmitAccountFeedback(userId: string | number, data: {
  action: 'deactivated' | 'deleted'
  reasons: string[]
  comment?: string
}): Promise<void> {
  const res = await fetch(`/api/users/${userId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Failed to save feedback')
  }
}

export async function apiReactivateAccount(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/reactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'Reactivation failed')
  }
}

export async function apiUploadAvatar(userId: string | number, file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/users/${userId}/avatar`, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Upload failed')
  }
  return res.json()
}

export async function apiDeleteAvatar(userId: string | number): Promise<void> {
  const res = await fetch(`/api/users/${userId}/avatar`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Delete failed')
  }
}
