import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db'
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  profiles,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { REVIEWER_EMAIL } from '@/lib/constants'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
  }),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
    ? [
        Apple({
          clientId: process.env.AUTH_APPLE_ID,
          clientSecret: process.env.AUTH_APPLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  Credentials({
    id: 'reviewer',
    name: 'Reviewer',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(creds) {
      // Lone purpose: let the App Store / Play Store reviewer log in without
      // bouncing through Google/Apple SSO. Hard-coded gate; not a real
      // password store.
      const email = String(creds?.email ?? '').trim().toLowerCase()
      const password = String(creds?.password ?? '')
      if (email !== REVIEWER_EMAIL.toLowerCase()) return null
      if (password !== process.env.REVIEWER_PASSWORD) return null
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (existing[0]) return existing[0]
      const inserted = await db.insert(users).values({ email, name: 'Reviewer' }).returning()
      return inserted[0] ?? null
    },
  }),
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/feed',
    error: '/feed',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id
      return token
    },
    async session({ session, token }) {
      if (token?.uid && session.user) {
        session.user.id = String(token.uid)
      }
      return session
    },
    async signIn({ user }) {
      if (!user.id || !user.email) return true
      // Ensure a `profiles` row exists alongside the Auth.js user. The
      // Drizzle adapter manages `users`; profiles is rabona-specific.
      const existing = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1)
      if (existing[0]) return true
      const base = (user.name || user.email.split('@')[0] || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 16) || 'user'
      let username = base
      for (let i = 0; i < 10; i++) {
        const clash = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.username, username))
          .limit(1)
        if (!clash[0]) break
        username = `${base}${Math.floor(Math.random() * 9999)}`
      }
      await db.insert(profiles).values({
        id: user.id,
        email: user.email,
        full_name: user.name ?? '',
        avatar_url: user.image ?? null,
        username,
      })
      return true
    },
  },
})
