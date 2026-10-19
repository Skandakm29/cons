import { beforeAll, describe, expect, it, vi } from "vitest";
import { MockEmailSender, SmtpEmailSender, getEmailSender, otpEmail } from "@/lib/auth/email";
import { createSignupToken, readSignupToken } from "@/lib/auth/signup-token";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "unit-test-secret";
});

describe("Google signup token", () => {
  const claims = { email: "new@example.com", name: "New User" };

  it("round-trips the verified email and name", () => {
    expect(readSignupToken(createSignupToken(claims))).toEqual(claims);
  });

  it("rejects a tampered payload or signature", () => {
    const [payload, sig] = createSignupToken(claims).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, email: "victim@example.com", exp: Date.now() + 60_000 })).toString("base64url");
    expect(readSignupToken(`${forged}.${sig}`)).toBeNull();
    expect(readSignupToken(`${payload}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(readSignupToken("garbage")).toBeNull();
  });

  it("expires after 15 minutes", () => {
    const t = createSignupToken(claims, 0);
    expect(readSignupToken(t, 14 * 60_000)).toEqual(claims);
    expect(readSignupToken(t, 16 * 60_000)).toBeNull();
  });

  it("is tied to the server secret", () => {
    const t = createSignupToken(claims);
    process.env.NEXTAUTH_SECRET = "a-different-secret";
    expect(readSignupToken(t)).toBeNull();
    process.env.NEXTAUTH_SECRET = "unit-test-secret";
  });
});

describe("email sender", () => {
  it("defaults to the console mock", () => {
    expect(getEmailSender({}).name).toBe("mock");
  });

  it("fails fast when SMTP settings are missing", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.gmail.com" })).toThrow(/SMTP_USER/);
    expect(() => getEmailSender({ EMAIL_PROVIDER: "postcard" })).toThrow(/Unknown/);
  });

  it("sends through the SMTP transport with the configured sender", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    await new SmtpEmailSender({ sendMail }, "BuildBid <me@gmail.com>").send(otpEmail("a@b.com", "123987"));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "BuildBid <me@gmail.com>", to: "a@b.com" }));
    expect(sendMail.mock.calls[0][0].subject).toContain("123987");
  });

  it("puts the code in both text and HTML bodies", async () => {
    const m = new MockEmailSender();
    vi.spyOn(console, "info").mockImplementation(() => {});
    await m.send(otpEmail("a@b.com", "445566"));
    expect(m.sent[0].text).toContain("445566");
    expect(m.sent[0].html).toContain("445566");
  });
});
