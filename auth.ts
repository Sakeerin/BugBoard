import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { isRateLimited, recordFailure, recordSuccess } from "@/lib/loginThrottle";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

// How long a JWT stays valid, and how often the jwt callback re-validates the
// user against the DB so deletes/role-changes propagate without waiting 30 days.
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours
const REVALIDATE_AFTER_MS = 5 * 60 * 1000; // 5 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email);

        // Brute-force throttle: reject early without hitting bcrypt/DB.
        if (isRateLimited(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user?.passwordHash) {
          recordFailure(email);
          return null;
        }

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash
        );
        if (!valid) {
          recordFailure(email);
          return null;
        }

        recordSuccess(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in: seed the token from the authorized user.
        token["id"] = user.id;
        token["role"] = user.role;
        token["refreshedAt"] = Date.now();
        return token;
      }

      // Periodically re-validate against the DB so a deleted or demoted user
      // loses access without waiting for the token to expire. Skip on the Edge
      // runtime (middleware) where Prisma cannot run — Node contexts (API
      // routes, RSC) run on every request and keep the token fresh there.
      if (process.env.NEXT_RUNTIME === "edge") return token;

      const last =
        typeof token["refreshedAt"] === "number" ? token["refreshedAt"] : 0;
      if (Date.now() - last < REVALIDATE_AFTER_MS) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token["id"] as string },
        select: { role: true },
      });
      if (!dbUser) return null; // user deleted -> invalidate the session

      token["role"] = dbUser.role;
      token["refreshedAt"] = Date.now();
      return token;
    },
    session({ session, token }) {
      // token has index signature so values are unknown — assert to known types
      session.user.id = token["id"] as string;
      session.user.role = token["role"] as Role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
