import 'server-only'

export type OAuthSignInInput = {
  provider: string
  providerAccountId: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}

// Placeholder so the failing tests fail on assertions, not on a missing import.
export async function resolveOAuthSignIn(_input: OAuthSignInInput): Promise<boolean | string> {
  return false
}
