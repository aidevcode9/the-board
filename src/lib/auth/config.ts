import { db } from '@/lib/db/client';
import { accounts, betaCodes, sessions, users } from '@/lib/db/schema';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq, isNull } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';

// NextAuth.js v5 (Auth.js) configuration.
// Exported as { auth, handlers, signIn, signOut } for use across the app.

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    // verificationsTable omitted — we use beta codes, not email verification
  }),

  providers: [
    Google({
      // ?? '' gives type `string` (not `string | undefined`), satisfying exactOptionalPropertyTypes.
      // Empty string causes a clear runtime OAuth error if env vars are not set — intentional.
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
  ],

  session: {
    strategy: 'database',
  },

  callbacks: {
    async signIn({ user }) {
      // Block sign-in if no email (shouldn't happen with Google, but guard it)
      if (!user.email) return false;

      // For new users: enforce the beta code gate server-side.
      // Direct hits to /api/auth/signin/google bypass the UI — this closes the bypass.
      const existingUser = await db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.email, user.email ?? ''),
        columns: { id: true },
      });

      if (!existingUser) {
        // New account — require a valid beta code cookie set by /api/auth/beta-code
        const cookieStore = await cookies();
        const betaCodeId = cookieStore.get('beta_code_id')?.value;
        if (!betaCodeId) return false;

        // Verify the code exists, isn't used, and isn't expired.
        // The actual atomic claim happens in createUser (where we have the real user ID).
        // TOCTOU window is negligible: signIn → createUser is milliseconds, and requires
        // two users to share the exact same httpOnly cookie value.
        const betaCode = await db.query.betaCodes.findFirst({
          where: (bc, { eq: eqFn }) => eqFn(bc.id, betaCodeId),
          columns: { usedBy: true, expiresAt: true },
        });
        if (!betaCode || betaCode.usedBy !== null) {
          cookieStore.delete('beta_code_id'); // Clean up invalid/used cookie
          return false;
        }
        if (betaCode.expiresAt !== null && betaCode.expiresAt < new Date()) {
          cookieStore.delete('beta_code_id'); // Clean up expired cookie
          return false;
        }
      }

      return true;
    },

    async session({ session, user }) {
      // Runtime role validation: only known roles pass through.
      // Falls safe to 'user' if DrizzleAdapter returns unexpected value.
      // Cast through unknown required: AdapterUser lacks index signature.
      const rawRole = (user as unknown as Record<string, unknown>).role;
      session.user.role = rawRole === 'admin' ? 'admin' : 'user';
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // 1. Atomically claim the beta code with real user ID.
      // UPDATE WHERE usedBy IS NULL ensures only one user can claim each code,
      // even if two concurrent signIns both passed the read check above.
      const cookieStore = await cookies();
      const betaCodeId = cookieStore.get('beta_code_id')?.value;
      if (betaCodeId) {
        await db
          .update(betaCodes)
          .set({ usedBy: user.id, usedAt: new Date() })
          .where(and(eq(betaCodes.id, betaCodeId), isNull(betaCodes.usedBy)));

        // Clear the cookie — it's been consumed, no reason to keep it.
        cookieStore.delete('beta_code_id');
      }

      // 2. Admin bootstrap: promote to admin if email matches ADMIN_EMAIL env var.
      // Only fires once per user (on first sign-in / account creation).
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase()) {
        await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
      }
    },
  },
});

// ── Session type augmentation ─────────────────────────────────────────────────
// Extends next-auth Session to include role.

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string; // optional to match NextAuth base type
      email: string;
      name?: string | null;
      image?: string | null;
      role: 'admin' | 'user';
    };
  }
}
