import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { BUSINESS_RULES } from "@/lib/config";

/** Delivers an OTP to a phone. Swap in MSG91 / Twilio by implementing this interface. */
export interface OtpProvider {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}

export class MockOtpProvider implements OtpProvider {
  readonly name = "mock";
  async send(phone: string, code: string): Promise<void> {
    console.info(`[otp:mock] OTP for +91${phone} is ${code}`);
  }
}

export function getOtpProvider(): OtpProvider {
  switch (process.env.OTP_PROVIDER ?? "mock") {
    case "mock":
      return new MockOtpProvider();
    // case "msg91": return new Msg91OtpProvider(process.env.MSG91_AUTH_KEY!, ...);
    // case "twilio": return new TwilioVerifyProvider(...);
    default:
      throw new Error(`Unknown OTP_PROVIDER "${process.env.OTP_PROVIDER}"`);
  }
}

export const DEV_BYPASS_CODE = "123456";
const RESEND_COOLDOWN_MS = 30_000;

const isDevBypassEnabled = () => process.env.NODE_ENV !== "production" && (process.env.OTP_PROVIDER ?? "mock") === "mock";

function hashCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${process.env.NEXTAUTH_SECRET ?? ""}`)
    .digest("hex");
}

export class OtpError extends Error {}

export async function requestOtp(phone: string, provider: OtpProvider = getOtpProvider()): Promise<void> {
  const recent = await prisma.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new OtpError("Please wait 30 seconds before requesting another code");
  }
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(Date.now() + BUSINESS_RULES.otpTtlMinutes * 60_000),
    },
  });
  await provider.send(phone, code);
}

/** Returns true if the code is valid; consumes it on success. */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (isDevBypassEnabled() && code === DEV_BYPASS_CODE) return true;

  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= BUSINESS_RULES.otpMaxAttempts) return false;

  const expected = Buffer.from(otp.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: ok ? { consumed: true } : { attempts: { increment: 1 } },
  });
  return ok;
}
