import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { login, trackLoginAttempt } from '@/lib/users'
import { findOrCreateOAuthUser } from '@/lib/oauth'

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
          const user = await login(credentials.username, credentials.password, ipAddress)
          await trackLoginAttempt({ userId: Number(user.id), successful: true, ipAddress })
          return { id: String(user.id), name: user.username, email: user.email }
        } catch {
          return null
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'apple') {
        if (!profile?.email) return false
        try {
          await findOrCreateOAuthUser({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email: profile.email,
            name: profile.name ?? null,
            avatarUrl: (profile as { picture?: string }).picture ?? null,
          })
          return true
        } catch {
          return false
        }
      }
      return true
    },

    async jwt({ token, account, profile, user }) {
      // On credential sign-in, user.id is already set
      if (user?.id) {
        token.userId = Number(user.id)
      }

      // On OAuth sign-in, look up our userId by email
      if (account?.provider === 'google' || account?.provider === 'apple') {
        if (profile?.email) {
          const [row] = await db
            .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.email, profile.email))
          if (row) {
            token.userId = row.id
            token.username = row.username
            token.avatarUrl = row.avatarUrl ?? null
          }
        }
      }

      // On credential sign-in, populate username/avatar from DB
      if (account?.provider === 'credentials' && token.userId && !token.username) {
        const [row] = await db
          .select({ username: users.username, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, token.userId as number))
        if (row) {
          token.username = row.username
          token.avatarUrl = row.avatarUrl ?? null
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = String(token.userId)
      session.user.name = token.username as string
      session.user.image = (token.avatarUrl as string | null) ?? session.user.image
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
  },
})
