import { z } from "zod";
import { phoneSchema } from "./common";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const requestOtpSchema = z.object({ phone: phoneSchema });
export const requestEmailOtpSchema = z.object({ email: emailSchema });

export const selfServiceRoles = ["HOMEOWNER", "BUILDER"] as const;
const nameSchema = z.string().trim().min(2, "Enter your name").max(80);
const roleSchema = z.enum(selfServiceRoles, { errorMap: () => ({ message: "Choose how you'll use the platform" }) });

/** Phone-OTP signup (SMS verifies the number). */
export const signupSchema = z.object({ name: nameSchema, phone: phoneSchema, role: roleSchema });
export type SignupInput = z.input<typeof signupSchema>;

/** Email-code signup: email is verified; phone is a contact number shared after an award. */
export const emailSignupSchema = z.object({ name: nameSchema, email: emailSchema, phone: phoneSchema, role: roleSchema });
export type EmailSignupInput = z.input<typeof emailSignupSchema>;

/** Finishing signup after Google sign-in (Google verified the email, carried in a signed token). */
export const googleSignupSchema = z.object({ token: z.string().min(10).max(2000), name: nameSchema, phone: phoneSchema, role: roleSchema });
export type GoogleSignupInput = z.input<typeof googleSignupSchema>;

/** Payload accepted by the "phone-otp" credentials provider. */
export const otpSignInSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), phone: phoneSchema, code: codeSchema }),
  z.object({ mode: z.literal("signup"), phone: phoneSchema, code: codeSchema, name: nameSchema, role: roleSchema }),
]);

/** Payload accepted by the "email-otp" credentials provider. */
export const emailSignInSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), email: emailSchema, code: codeSchema }),
  z.object({ mode: z.literal("signup"), email: emailSchema, code: codeSchema, name: nameSchema, phone: phoneSchema, role: roleSchema }),
]);
