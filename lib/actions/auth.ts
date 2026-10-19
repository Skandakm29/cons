"use server";

import { prisma } from "@/lib/db";
import { isEmailDevBypass, OtpError, requestEmailOtp, requestOtp } from "@/lib/auth/otp";
import { readSignupToken } from "@/lib/auth/signup-token";
import {
  emailSignupSchema,
  googleSignupSchema,
  requestEmailOtpSchema,
  requestOtpSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { ActionError, runAction, type ActionResult } from "./result";

/** `to` is the normalised phone or email the code was sent to. */
type CodeSent = { to: string; devHint: string | null };

const DEV_HINT = "Dev mode: use 123456, or the code printed in the server console.";
const smsDevHint = () =>
  process.env.NODE_ENV !== "production" && (process.env.OTP_PROVIDER ?? "mock") === "mock" ? DEV_HINT : null;
const emailDevHint = () => (isEmailDevBypass() ? DEV_HINT : null);

async function deliver(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof OtpError) throw new ActionError(e.message);
    throw e;
  }
}

// --- Phone (SMS) -----------------------------------------------------------

export async function requestLoginOtpAction(input: unknown): Promise<ActionResult<CodeSent>> {
  return runAction(async () => {
    const { phone } = requestOtpSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { phone }, select: { phoneVerified: true } });
    if (!user) throw new ActionError("No account for this number — please sign up first");
    if (!user.phoneVerified) throw new ActionError("This number isn't verified for SMS login — please use email or Google");
    await deliver(() => requestOtp(phone));
    return { to: phone, devHint: smsDevHint() };
  });
}

export async function requestSignupOtpAction(input: unknown): Promise<ActionResult<CodeSent>> {
  return runAction(async () => {
    const { phone } = signupSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (user) throw new ActionError("This number is already registered — please log in");
    await deliver(() => requestOtp(phone));
    return { to: phone, devHint: smsDevHint() };
  });
}

// --- Email -----------------------------------------------------------------

export async function requestEmailLoginOtpAction(input: unknown): Promise<ActionResult<CodeSent>> {
  return runAction(async () => {
    const { email } = requestEmailOtpSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new ActionError("No account for this email — please sign up first");
    await deliver(() => requestEmailOtp(email));
    return { to: email, devHint: emailDevHint() };
  });
}

export async function requestEmailSignupOtpAction(input: unknown): Promise<ActionResult<CodeSent>> {
  return runAction(async () => {
    const { email, phone } = emailSignupSchema.parse(input);
    const [byEmail, byPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone }, select: { id: true } }),
    ]);
    if (byEmail) throw new ActionError("This email is already registered — please log in");
    if (byPhone) throw new ActionError("This mobile number is already registered to another account");
    await deliver(() => requestEmailOtp(email));
    return { to: email, devHint: emailDevHint() };
  });
}

// --- Google ----------------------------------------------------------------

/** Creates the account for a first-time Google user; the client then signs in with the same token. */
export async function completeGoogleSignupAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const v = googleSignupSchema.parse(input);
    const claims = readSignupToken(v.token);
    if (!claims) throw new ActionError("This signup link has expired — please continue with Google again");
    const [byEmail, byPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: claims.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone: v.phone }, select: { id: true } }),
    ]);
    // Already created (e.g. double submit) — let the client sign in.
    if (byEmail) return undefined;
    if (byPhone) throw new ActionError("This mobile number is already registered to another account");
    await prisma.user.create({ data: { name: v.name, email: claims.email, phone: v.phone, role: v.role } });
    return undefined;
  });
}
