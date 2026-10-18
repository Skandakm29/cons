"use server";

import { prisma } from "@/lib/db";
import { OtpError, requestOtp } from "@/lib/auth/otp";
import { requestOtpSchema, signupSchema } from "@/lib/validation/auth";
import { ActionError, runAction, type ActionResult } from "./result";

type OtpSent = { phone: string; devHint: string | null };

const devHint = () =>
  process.env.NODE_ENV !== "production" && (process.env.OTP_PROVIDER ?? "mock") === "mock"
    ? "Dev mode: use 123456, or the code printed in the server console."
    : null;

async function send(phone: string): Promise<OtpSent> {
  try {
    await requestOtp(phone);
  } catch (e) {
    if (e instanceof OtpError) throw new ActionError(e.message);
    throw e;
  }
  return { phone, devHint: devHint() };
}

export async function requestLoginOtpAction(input: unknown): Promise<ActionResult<OtpSent>> {
  return runAction(async () => {
    const { phone } = requestOtpSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) throw new ActionError("No account for this number — please sign up first");
    return send(phone);
  });
}

export async function requestSignupOtpAction(input: unknown): Promise<ActionResult<OtpSent>> {
  return runAction(async () => {
    const { phone } = signupSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (user) throw new ActionError("This number is already registered — please log in");
    return send(phone);
  });
}
