import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { emailSignInSchema, otpSignInSchema } from "@/lib/validation/auth";
import { verifyEmailOtp, verifyOtp } from "./otp";
import { createSignupToken, readSignupToken } from "./signup-token";

export const isGoogleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const sessionUser = (u: { id: string; name: string; role: "HOMEOWNER" | "BUILDER" | "ADMIN" }) => ({ id: u.id, name: u.name, role: u.role });

/** Friendly message when a unique contact detail already belongs to another account. */
async function assertContactsFree(email: string | null, phone: string) {
  const [byEmail, byPhone] = await Promise.all([
    email ? prisma.user.findUnique({ where: { email }, select: { id: true } }) : null,
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  if (byEmail) throw new Error("An account already exists for this email — please log in");
  if (byPhone) throw new Error("This mobile number is already registered to another account");
}

const providers: Provider[] = [
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

      if (!(await verifyOtp(input.phone, input.code))) throw new Error("Incorrect or expired code");

      const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (input.mode === "login") {
        if (!existing) throw new Error("No account for this number — please sign up");
        // A number typed in at email/Google signup was never proven by SMS, so it can't be used to log in.
        if (!existing.phoneVerified) throw new Error("This number isn't verified for SMS login — please use email or Google");
        return sessionUser(existing);
      }
      if (existing) throw new Error("An account already exists for this number — please log in");
      const user = await prisma.user.create({
        data: { name: input.name, phone: input.phone, phoneVerified: true, role: input.role },
      });
      return sessionUser(user);
    },
  }),
  CredentialsProvider({
    id: "email-otp",
    name: "Email code",
    credentials: {
      mode: { type: "text" },
      email: { type: "email" },
      code: { type: "text" },
      name: { type: "text" },
      phone: { type: "tel" },
      role: { type: "text" },
    },
    async authorize(raw) {
      const parsed = emailSignInSchema.safeParse(raw);
      if (!parsed.success) throw new Error("Invalid sign-in details");
      const input = parsed.data;

      if (!(await verifyEmailOtp(input.email, input.code))) throw new Error("Incorrect or expired code");

      if (input.mode === "login") {
        const existing = await prisma.user.findUnique({ where: { email: input.email } });
        if (!existing) throw new Error("No account for this email — please sign up");
        return sessionUser(existing);
      }
      await assertContactsFree(input.email, input.phone);
      const user = await prisma.user.create({
        data: { name: input.name, email: input.email, phone: input.phone, role: input.role },
      });
      return sessionUser(user);
    },
  }),
  CredentialsProvider({
    // Second half of a first-time Google sign-in: the account was just created by
    // completeGoogleSignupAction; this exchanges the signed token for a session.
    id: "google-signup",
    name: "Finish Google signup",
    credentials: { token: { type: "text" } },
    async authorize(raw) {
      const claims = typeof raw?.token === "string" ? readSignupToken(raw.token) : null;
      if (!claims) throw new Error("This signup link has expired — please continue with Google again");
      const user = await prisma.user.findUnique({ where: { email: claims.email } });
      if (!user) throw new Error("Please finish signing up first");
      return sessionUser(user);
    },
  }),
];

if (isGoogleEnabled()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Our session user is resolved from the DB by email in the callbacks below.
      profile: (p: { sub: string; name?: string; email?: string }) => ({ id: p.sub, name: p.name ?? "", email: p.email, role: "HOMEOWNER" }),
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const p = profile as { email?: string; email_verified?: boolean; name?: string } | undefined;
      const email = p?.email?.trim().toLowerCase();
      if (!email || p?.email_verified !== true) return "/login?error=GoogleEmailUnverified";
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) return true;
      // First visit: collect phone + role before creating the account.
      return `/complete-signup?token=${encodeURIComponent(createSignupToken({ email, name: p?.name ?? "" }))}`;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const email = token.email?.toLowerCase();
        const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
        }
      } else if (user) {
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
