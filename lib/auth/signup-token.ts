import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, HMAC-signed proof that Google verified this email, used to finish
 * signup (phone + role) for a first-time Google user before an account exists.
 */
export interface GoogleSignupClaims {
  email: string;
  name: string;
}

const TTL_MS = 15 * 60_000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`google-signup:${payload}`).digest("base64url");

export function createSignupToken(claims: GoogleSignupClaims, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the claims if the token is authentic and unexpired, otherwise null. */
export function readSignupToken(token: string, now = Date.now()): GoogleSignupClaims | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as Partial<GoogleSignupClaims & { exp: number }>;
    if (typeof data.email !== "string" || typeof data.name !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < now) return null;
    return { email: data.email, name: data.name };
  } catch {
    return null;
  }
}
