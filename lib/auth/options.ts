import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { otpSignInSchema } from "@/lib/validation/auth";
import { verifyOtp } from "./otp";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        mode: { type: "text" },
        phone: { type: "tel" },
        code: { type: "text" },
        name: { type: "text" },
        role: { type: "text" },
      },
      async authorize(raw) {
        const parsed = otpSignInSchema.safeParse(raw);
        if (!parsed.success) throw new Error("Invalid sign-in details");
        const input = parsed.data;

        if (!(await verifyOtp(input.phone, input.code))) throw new Error("Incorrect or expired OTP");

        const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
        if (input.mode === "login") {
          if (!existing) throw new Error("No account for this number — please sign up");
          return { id: existing.id, name: existing.name, role: existing.role };
        }
        if (existing) throw new Error("An account already exists for this number — please log in");
        const user = await prisma.user.create({
          data: { name: input.name, phone: input.phone, role: input.role },
        });
        return { id: user.id, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = { id: token.uid, name: token.name ?? "", role: token.role };
      return session;
    },
  },
};
