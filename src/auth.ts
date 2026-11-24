import NextAuth, { CredentialsSignin } from 'next-auth'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users, oauthAccounts } from '@/db/schema'
import { login, trackLoginAttempt } from '@/lib/users'
import { resolveOAuthSignIn } from '@/lib/oauthSignIn'

class AccountDeactivatedError extends CredentialsSignin {
  code = 'ACCOUNT_DEACTIVATED' as const
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function isPasswordExpired(passwordChangedAt: Date | null | undefined): boolean {
  if (!passwordChangedAt) return false
  return passwordChangedAt.getTime() < Date.now() - NINETY_DAYS_MS
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        username: { label: 'Username' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (
          typeof credentials.username !== 'string' ||
          typeof credentials.password !== 'string'
        ) return null

        const { getClientIp } = await import('@/lib/ip')
        const ipAddress = getClientIp(request.headers)

        try {
          const user = await login({ username: credentials.username, password: credentials.password, ipAddress })
          await trackLoginAttempt({ userId: Number(user.id), successful: true, ipAddress })
          return { id: String(user.id), name: user.username, email: user.email }
        } catch (err) {
          if (err instanceof Error && err.message === 'ACCOUNT_DEACTIVATED') {
            throw new AccountDeactivatedError()
          }
          return null
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'apple') {
        // Invite-only lock (ADR-0032): returns true, false, or '/waitlist' (no session).
        return resolveOAuthSignIn({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: profile?.email,
          emailVerified: profile?.email_verified as boolean | string | undefined,
          name: profile?.name ?? null,
          avatarUrl: (profile as { picture?: string } | undefined)?.picture ?? null,
        })
      }
      return true
    },

    async jwt({ token, account, profile, user, trigger, session }) {
      // When the client calls update({ needsOnboarding: false }), clear the flag
      if (trigger === 'update' && session?.needsOnboarding === false) {
        token.needsOnboarding = false
        return token
      }

      // After a password reset, refresh passwordChangedAt and clear the forced-reset flag
      if (trigger === 'update' && session?.passwordChangedAt) {
        token.passwordChangedAt = session.passwordChangedAt
        token.needsPasswordReset = false
        return token
      }

      // After a username change, refresh the username in the token
      if (trigger === 'update' && session?.username) {
        token.username = session.username
        return token
      }

      // On credential sign-in, user.id is already set
      if (user?.id) {
        token.userId = Number(user.id)
      }

      // On OAuth sign-in, look up our userId — by email if available, else by providerAccountId
      // (Apple omits email on subsequent sign-ins)
      if (account?.provider === 'google' || account?.provider === 'apple') {
        let row: { id: number; username: string; avatarUrl: string | null; onboardingCompletedAt: Date | null; password: string | null } | undefined

        if (profile?.email) {
          const [r] = await db
            .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl, onboardingCompletedAt: users.onboardingCompletedAt, password: users.password })
            .from(users)
            .where(sql`lower(${users.email}) = lower(${profile.email})`)
          row = r
        } else {
          const [link] = await db
            .select({ userId: oauthAccounts.userId })
            .from(oauthAccounts)
            .where(eq(oauthAccounts.providerAccountId, account.providerAccountId))
          if (link) {
            const [r] = await db
              .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl, onboardingCompletedAt: users.onboardingCompletedAt, password: users.password })
              .from(users)
              .where(eq(users.id, link.userId))
            row = r
          }
        }

        if (row) {
          token.userId = row.id
          token.username = row.username
          token.avatarUrl = row.avatarUrl ?? null
          // Only show onboarding for OAuth-only accounts (no password) that haven't completed it.
          // Credential users who link OAuth have a password and skip onboarding.
          const isOAuthOnlyAccount = !row.password
          token.needsOnboarding = isOAuthOnlyAccount && !row.onboardingCompletedAt
        }
      }

      // On credential sign-in, populate username/avatar/passwordChangedAt from DB
      if (account?.provider === 'credentials' && token.userId && !token.username) {
        const [row] = await db
          .select({ username: users.username, avatarUrl: users.avatarUrl, passwordChangedAt: users.passwordChangedAt })
          .from(users)
          .where(eq(users.id, token.userId as number))
        if (row) {
          token.username = row.username
          token.avatarUrl = row.avatarUrl ?? null
          token.passwordChangedAt = row.passwordChangedAt?.toISOString() ?? null
          token.needsPasswordReset = isPasswordExpired(row.passwordChangedAt)
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = String(token.userId)
      session.user.name = token.username as string
      session.user.image = (token.avatarUrl as string | null) ?? session.user.image
      ;(session.user as { needsOnboarding?: boolean }).needsOnboarding = (token.needsOnboarding as boolean | undefined) ?? false
      ;(session.user as { needsPasswordReset?: boolean }).needsPasswordReset = (token.needsPasswordReset as boolean | undefined) ?? false
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
  },

  trustHost: true,
})
