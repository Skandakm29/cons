import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db";
import { MockEmailSender } from "@/lib/auth/email";
import { OtpError, requestEmailOtp, verifyEmailOtp } from "@/lib/auth/otp";
import { authOptions } from "@/lib/auth/options";
import { createSignupToken } from "@/lib/auth/signup-token";
import { completeGoogleSignupAction, requestEmailSignupOtpAction, requestLoginOtpAction } from "@/lib/actions/auth";

const TAG = `ea${Date.now().toString().slice(-6)}`;
const email = (n: number) => `${TAG}.${n}@example.com`;
const phone = (n: number) => `7${TAG.slice(2)}${n.toString().padStart(3, "0")}`;
const codeFrom = (m: MockEmailSender) => /\b(\d{6})\b/.exec(m.sent.at(-1)!.text)![1];

type Authorize = (credentials: Record<string, string>, req: object) => Promise<{ id: string; role: string } | null>;
function authorize(id: string): Authorize {
  // Credentials providers keep their custom id and authorize() under `.options`.
  const all = authOptions.providers as unknown as { options?: { id?: string; authorize?: Authorize } }[];
  const fn = all.find((x) => x.options?.id === id)?.options?.authorize;
  if (!fn) throw new Error(`No credentials provider "${id}"`);
  return fn;
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET ??= "integration-secret";
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: TAG } }, { name: { startsWith: TAG } }] } });
  await prisma.otpCode.deleteMany({ where: { identifier: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("email codes", () => {
  it("sends a code that verifies once", async () => {
    const mail = new MockEmailSender();
    await requestEmailOtp(email(1), mail);
    const code = codeFrom(mail);
    expect(await verifyEmailOtp(email(1), code === "000000" ? "000001" : "000000")).toBe(false);
    expect(await verifyEmailOtp(email(1), code)).toBe(true);
    expect(await verifyEmailOtp(email(1), code)).toBe(false); // single use
  });

  it("enforces the resend cooldown", async () => {
    const mail = new MockEmailSender();
    await requestEmailOtp(email(2), mail);
    await expect(requestEmailOtp(email(2), mail)).rejects.toBeInstanceOf(OtpError);
  });
});

describe("email signup and login (NextAuth authorize)", () => {
  it("creates an account whose phone is NOT marked verified", async () => {
    const mail = new MockEmailSender();
    await requestEmailOtp(email(3), mail);
    const user = await authorize("email-otp")(
      { mode: "signup", email: email(3).toUpperCase(), code: codeFrom(mail), name: `${TAG} Email User`, phone: phone(3), role: "HOMEOWNER" },
      {},
    );
    expect(user?.role).toBe("HOMEOWNER");
    const row = await prisma.user.findUniqueOrThrow({ where: { email: email(3) } });
    expect(row).toMatchObject({ phone: phone(3), phoneVerified: false });
  });

  it("logs back in by email", async () => {
    const mail = new MockEmailSender();
    await new Promise((r) => setTimeout(r, 10));
    await prisma.otpCode.deleteMany({ where: { identifier: email(3) } });
    await requestEmailOtp(email(3), mail);
    const user = await authorize("email-otp")({ mode: "login", email: email(3), code: codeFrom(mail) }, {});
    expect(user).not.toBeNull();
  });

  it("refuses SMS login with an unverified phone", async () => {
    const res = await requestLoginOtpAction({ phone: phone(3) });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/isn't verified/) });
  });

  it("refuses signup with an email or phone that's taken", async () => {
    expect(await requestEmailSignupOtpAction({ name: "X Y", email: email(3), phone: phone(99), role: "BUILDER" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/email is already registered/),
    });
    expect(await requestEmailSignupOtpAction({ name: "X Y", email: email(98), phone: phone(3), role: "BUILDER" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/mobile number is already registered/),
    });
  });
});

describe("first-time Google signup", () => {
  it("creates the account from a signed token and signs in with it", async () => {
    const token = createSignupToken({ email: email(4), name: "Google Person" });
    const res = await completeGoogleSignupAction({ token, name: `${TAG} Google Person`, phone: phone(4), role: "BUILDER" });
    expect(res.ok).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { email: email(4) } });
    expect(row).toMatchObject({ role: "BUILDER", phoneVerified: false });
    const user = await authorize("google-signup")({ token }, {});
    expect(user).toMatchObject({ id: row.id, role: "BUILDER" });
  });

  it("rejects a forged token", async () => {
    const res = await completeGoogleSignupAction({ token: "abc.def.ghi-forged", name: "Bad Actor", phone: phone(5), role: "HOMEOWNER" });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
    await expect(authorize("google-signup")({ token: "abc.def" }, {})).rejects.toThrow(/expired/);
  });

  it("won't reuse another account's phone", async () => {
    const token = createSignupToken({ email: email(6), name: "Someone" });
    const res = await completeGoogleSignupAction({ token, name: `${TAG} Someone`, phone: phone(4), role: "HOMEOWNER" });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already registered/) });
  });
});
