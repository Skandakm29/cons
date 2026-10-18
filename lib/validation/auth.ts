import { z } from "zod";
import { phoneSchema } from "./common";

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const selfServiceRoles = ["HOMEOWNER", "BUILDER"] as const;

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: phoneSchema,
  role: z.enum(selfServiceRoles, { errorMap: () => ({ message: "Choose how you'll use the platform" }) }),
});
export type SignupInput = z.input<typeof signupSchema>;

/** Payload accepted by the NextAuth credentials provider. */
export const otpSignInSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), phone: phoneSchema, code: z.string().regex(/^\d{6}$/) }),
  z.object({
    mode: z.literal("signup"),
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/),
    name: signupSchema.shape.name,
    role: signupSchema.shape.role,
  }),
]);
