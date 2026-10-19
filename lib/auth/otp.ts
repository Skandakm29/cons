import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { BUSINESS_RULES } from "@/lib/config";

type Env = Record<string, string | undefined>;

/** Delivers a code we generate and verify ourselves (MSG91, mock). */
export interface OtpProvider {
  readonly name: string;
  readonly hosted?: false;
  send(phone: string, code: string): Promise<void>;
}

/** Generates, sends and checks the code itself (Twilio Verify). */
export interface HostedOtpProvider {
  readonly name: string;
  readonly hosted: true;
  start(phone: string): Promise<void>;
  check(phone: string, code: string): Promise<boolean>;
}

export type AnyOtpProvider = OtpProvider | HostedOtpProvider;

/** An error whose message is safe to show to the user. */
export class OtpError extends Error {}

export class MockOtpProvider implements OtpProvider {
  readonly name = "mock";
  async send(phone: string, code: string): Promise<void> {
    console.info(`[otp:mock] OTP for +91${phone} is ${code}`);
  }
}

/**
 * Twilio Verify: Twilio generates the code, sends the SMS (handling Indian DLT rules) and checks it.
 * Create a Verify Service in the Twilio console to get the service SID.
 */
export class TwilioVerifyProvider implements HostedOtpProvider {
  readonly name = "twilio";
  readonly hosted = true;
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly serviceSid: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private post(path: string, params: Record<string, string>) {
    return this.fetchFn(`https://verify.twilio.com/v2/Services/${this.serviceSid}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });
  }

  async start(phone: string): Promise<void> {
    const res = await this.post("Verifications", { To: `+91${phone}`, Channel: "sms" });
    if (!res.ok) {
      console.error(`[otp:twilio] start failed ${res.status}: ${await res.text().catch(() => "")}`);
      throw new OtpError("Couldn't send the SMS. Please try again in a minute.");
    }
  }

  async check(phone: string, code: string): Promise<boolean> {
    const res = await this.post("VerificationCheck", { To: `+91${phone}`, Code: code });
    // 404 = no pending verification (expired, already used, or too many attempts).
    if (res.status === 404) return false;
    if (!res.ok) {
      console.error(`[otp:twilio] check failed ${res.status}: ${await res.text().catch(() => "")}`);
      return false;
    }
    const json = (await res.json().catch(() => null)) as { status?: string } | null;
    return json?.status === "approved";
  }
}

/** MSG91 Flow API. The DLT-approved template must contain a variable for the code (default name: "otp"). */
export class Msg91OtpProvider implements OtpProvider {
  readonly name = "msg91";
  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
    private readonly otpVar = "otp",
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    const res = await this.fetchFn("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: this.authKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        template_id: this.templateId,
        short_url: "0",
        recipients: [{ mobiles: `91${phone}`, [this.otpVar]: code }],
      }),
    });
    const json = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
    if (!res.ok || json?.type === "error") {
      console.error(`[otp:msg91] send failed ${res.status}: ${json?.message ?? ""}`);
      throw new OtpError("Couldn't send the SMS. Please try again in a minute.");
    }
  }
}

function requireEnv(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} must be set when OTP_PROVIDER=${env.OTP_PROVIDER}`);
  return v;
}

export function getOtpProvider(env: Env = process.env): AnyOtpProvider {
  switch (env.OTP_PROVIDER ?? "mock") {
    case "mock":
      return new MockOtpProvider();
    case "twilio":
      return new TwilioVerifyProvider(
        requireEnv(env, "TWILIO_ACCOUNT_SID"),
        requireEnv(env, "TWILIO_AUTH_TOKEN"),
        requireEnv(env, "TWILIO_VERIFY_SERVICE_SID"),
      );
    case "msg91":
      return new Msg91OtpProvider(requireEnv(env, "MSG91_AUTH_KEY"), requireEnv(env, "MSG91_TEMPLATE_ID"), env.MSG91_OTP_VAR || "otp");
    default:
      throw new Error(`Unknown OTP_PROVIDER "${env.OTP_PROVIDER}"`);
  }
}

export const TEST_CODE = "123456";

/** Numbers in OTP_TEST_NUMBERS (comma-separated, 10 digits) can always log in with the test code. */
export function isTestNumber(phone: string, env: Env = process.env): boolean {
  return (env.OTP_TEST_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(phone);
}

/** Local development with the mock provider accepts the test code for every number. */
export function isDevBypass(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && (env.OTP_PROVIDER ?? "mock") === "mock";
}

export function acceptsTestCode(phone: string, code: string, env: Env = process.env): boolean {
  return code === TEST_CODE && (isDevBypass(env) || isTestNumber(phone, env));
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${process.env.NEXTAUTH_SECRET ?? ""}`)
    .digest("hex");
}

const RESEND_COOLDOWN_MS = 30_000;

export async function requestOtp(phone: string, provider: AnyOtpProvider = getOtpProvider()): Promise<void> {
  // Test numbers use the fixed test code; never spend an SMS on them.
  if (isTestNumber(phone)) return;
  if (provider.name === "mock" && process.env.NODE_ENV === "production") {
    throw new OtpError("SMS login isn't switched on yet. Please try again later.");
  }

  const recent = await prisma.otpCode.findMany({
    where: { phone, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new OtpError("Please wait 30 seconds before requesting another code");
  }
  if (recent.length >= BUSINESS_RULES.otpMaxPerHour) {
    throw new OtpError("Too many codes requested for this number. Please try again in an hour.");
  }

  if (provider.hosted) {
    // The provider owns the code; we still record the request for rate limiting.
    await prisma.otpCode.create({ data: { phone, codeHash: "hosted", expiresAt: new Date(), consumed: true } });
    await provider.start(phone);
    return;
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
export async function verifyOtp(phone: string, code: string, provider: AnyOtpProvider = getOtpProvider()): Promise<boolean> {
  if (acceptsTestCode(phone, code)) return true;
  if (provider.hosted) return provider.check(phone, code);

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
