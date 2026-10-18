import { z } from "zod";
import { SUPPORTED_CITIES } from "@/lib/config";
import { BREAKDOWN_CATEGORIES, PACKAGES } from "@/lib/estimator/types";

/** Indian mobile number: 10 digits starting 6–9. Accepts optional +91 / 0 prefix and spaces. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const citySchema = z.enum(SUPPORTED_CITIES, { errorMap: () => ({ message: "Choose a supported city" }) });
export const packageSchema = z.enum(PACKAGES);

export const rupees = (label: string, max = 500_000_000) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number of rupees`)
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} is too large`);

export const intRange = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

/** Absolute http(s) URL. */
export const httpUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine((v) => /^https?:\/\//i.test(v), "URL must start with http:// or https://");

/** Either an uploaded file path (/uploads/...) or an absolute http(s) URL. */
export const assetUrl = z
  .string()
  .trim()
  .refine((v) => /^\/(uploads|seed)\/[\w./-]+$/.test(v) && !v.includes("..") || /^https?:\/\//i.test(v), "Invalid file URL");

export const breakdownAmountsSchema = z.object(
  Object.fromEntries(BREAKDOWN_CATEGORIES.map((c) => [c, rupees("Amount")])) as Record<
    (typeof BREAKDOWN_CATEGORIES)[number],
    ReturnType<typeof rupees>
  >,
);
export type BreakdownAmounts = z.infer<typeof breakdownAmountsSchema>;

export const breakdownPercentsSchema = z
  .object(
    Object.fromEntries(BREAKDOWN_CATEGORIES.map((c) => [c, z.number().min(0).max(100)])) as Record<
      (typeof BREAKDOWN_CATEGORIES)[number],
      z.ZodNumber
    >,
  )
  .refine((p) => Math.abs(Object.values(p).reduce((s, v) => s + v, 0) - 100) < 0.01, {
    message: "Percentages must add up to 100",
  });

export const paymentMilestonesSchema = z
  .array(
    z.object({
      name: z.string().trim().min(2, "Name the milestone").max(80),
      percent: z.number({ invalid_type_error: "Enter a %" }).int("Use whole percentages").min(1, "At least 1%").max(100),
    }),
  )
  .min(2, "Add at least 2 milestones")
  .max(12, "At most 12 milestones")
  .refine((ms) => ms.reduce((s, m) => s + m.percent, 0) === 100, {
    message: "Milestone percentages must total exactly 100%",
  });

export const idSchema = z.string().min(1).max(64);
