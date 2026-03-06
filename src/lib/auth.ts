import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/server/db/schema";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
    }),
    // Dev-mode credentials provider — accepts any email, no password required
    ...(process.env.NODE_ENV !== "production"
      ? [
          Credentials({
            name: "Dev Login",
            credentials: {
              email: {
                label: "Email",
                type: "email",
                placeholder: "dev@suds.local",
              },
            },
            async authorize(credentials) {
              const email = credentials?.email as string | undefined;
              if (!email) return null;

              // Find existing user by email
              const [existing] = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

              if (existing) {
                return {
                  id: existing.id,
                  email: existing.email,
                  name: existing.name ?? email.split("@")[0],
                };
              }

              // Create new dev user
              const [created] = await db
                .insert(users)
                .values({
                  email,
                  name: email.split("@")[0],
                  emailVerified: new Date(),
                })
                .returning();

              if (!created) return null;

              return {
                id: created.id,
                email: created.email,
                name: created.name ?? email.split("@")[0],
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
