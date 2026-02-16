import NextAuth, { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import crypto from "crypto";


declare module "next-auth" {
  interface Profile {
    hd?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma), // persist users/accounts/sessions in Postgres
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          hd: "vierradev.com",
        },
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = creds?.email?.trim().toLowerCase();
        const password = creds?.password ?? "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordEnc) return null;
        let storedPlain: string;
        try {
          storedPlain = decrypt(user.passwordEnc);
        } catch {
          return null;
        }
        const ok =
          storedPlain.length === password.length &&
          crypto.timingSafeEqual(Buffer.from(storedPlain), Buffer.from(password));

        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email!,
          role: user.role,
          name: (user as any).name ?? undefined,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase() ?? "";
        const hd = (profile as any)?.hd as string | undefined;
        if (hd === "vierradev.com" || email.endsWith("@vierradev.com")) return true;
        return false; // sends ?error=AccessDenied to pages.error
      }
      return true; // credentials path already verified
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;    
        token.role = (user as any).role;    
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);