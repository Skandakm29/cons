import { describe, expect, it, vi } from "vitest";
import {
  Msg91OtpProvider,
  OtpError,
  TwilioVerifyProvider,
  acceptsTestCode,
  getOtpProvider,
} from "@/lib/auth/otp";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("test code (123456)", () => {
  it("works for every number in local dev with the mock provider", () => {
    expect(acceptsTestCode("9876543210", "123456", { NODE_ENV: "development" })).toBe(true);
  });

  it("is refused in production unless the number is allow-listed", () => {
    const env = { NODE_ENV: "production", OTP_PROVIDER: "twilio", OTP_TEST_NUMBERS: "9000000000, 9000000001" };
    expect(acceptsTestCode("9876543210", "123456", env)).toBe(false);
    expect(acceptsTestCode("9000000001", "123456", env)).toBe(true);
    expect(acceptsTestCode("9000000001", "000000", env)).toBe(false);
  });

  it("is refused in dev when a real provider is configured", () => {
    expect(acceptsTestCode("9876543210", "123456", { NODE_ENV: "development", OTP_PROVIDER: "msg91" })).toBe(false);
  });
});

describe("getOtpProvider", () => {
  it("fails fast when provider credentials are missing", () => {
    expect(() => getOtpProvider({ OTP_PROVIDER: "twilio" })).toThrow(/TWILIO_ACCOUNT_SID/);
    expect(() => getOtpProvider({ OTP_PROVIDER: "msg91", MSG91_AUTH_KEY: "k" })).toThrow(/MSG91_TEMPLATE_ID/);
    expect(() => getOtpProvider({ OTP_PROVIDER: "carrier-pigeon" })).toThrow(/Unknown/);
  });
});

describe("TwilioVerifyProvider", () => {
  it("starts an SMS verification for the +91 number", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ status: "pending" }, 201));
    await new TwilioVerifyProvider("AC1", "tok", "VA1", fetchFn).start("9876543210");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://verify.twilio.com/v2/Services/VA1/Verifications");
    expect(String(init?.body)).toBe("To=%2B919876543210&Channel=sms");
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
  });

  it("approves only when Twilio says approved", async () => {
    const ok = new TwilioVerifyProvider("AC1", "tok", "VA1", vi.fn<typeof fetch>().mockResolvedValue(json({ status: "approved" })));
    const wrong = new TwilioVerifyProvider("AC1", "tok", "VA1", vi.fn<typeof fetch>().mockResolvedValue(json({ status: "pending" })));
    const expired = new TwilioVerifyProvider("AC1", "tok", "VA1", vi.fn<typeof fetch>().mockResolvedValue(json({}, 404)));
    expect(await ok.check("9876543210", "111111")).toBe(true);
    expect(await wrong.check("9876543210", "111111")).toBe(false);
    expect(await expired.check("9876543210", "111111")).toBe(false);
  });

  it("raises a user-safe error when sending fails", async () => {
    const p = new TwilioVerifyProvider("AC1", "tok", "VA1", vi.fn<typeof fetch>().mockResolvedValue(json({ message: "bad" }, 400)));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(p.start("9876543210")).rejects.toBeInstanceOf(OtpError);
  });
});

describe("Msg91OtpProvider", () => {
  it("sends the code through the flow template", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ type: "success" }));
    await new Msg91OtpProvider("key", "tmpl", "otp", fetchFn).send("9876543210", "424242");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://control.msg91.com/api/v5/flow");
    expect((init?.headers as Record<string, string>).authkey).toBe("key");
    expect(JSON.parse(String(init?.body))).toEqual({
      template_id: "tmpl",
      short_url: "0",
      recipients: [{ mobiles: "919876543210", otp: "424242" }],
    });
  });

  it("treats an MSG91 error payload as a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const p = new Msg91OtpProvider("key", "tmpl", "otp", vi.fn<typeof fetch>().mockResolvedValue(json({ type: "error", message: "invalid template" })));
    await expect(p.send("9876543210", "424242")).rejects.toBeInstanceOf(OtpError);
  });
});
