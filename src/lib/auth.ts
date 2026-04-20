import NextAuth, { type DefaultSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import { prisma } from "./prisma"

const ADMIN_EMAILS = ["2000mageia@gmail.com", "mainsoft.demo2024@gmail.com", "mainsoft2024@gmail.com"]

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
      }

      const userId = (token.id ?? user?.id) as string | undefined
      if (!userId) {
        return token
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },
      })

      if (!dbUser) {
        return token
      }

      if (dbUser.email && ADMIN_EMAILS.includes(dbUser.email) && dbUser.role !== "admin") {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { role: "admin" },
        })
        token.role = "admin"
        return token
      }

      token.role = dbUser.role
      return token
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
      }
      session.user.role = (token.role as string | undefined) ?? "user"
      return session
    },
  },
  pages: { signIn: "/login" },
})

declare module "next-auth" {
  interface Session {
    user: { id: string; role: string } & DefaultSession["user"]
  }
}
