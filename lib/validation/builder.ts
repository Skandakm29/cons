import { z } from "zod";
import { SUPPORTED_CITIES } from "@/lib/config";
import { assetUrl, idSchema, intRange } from "./common";

export const builderProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(120),
  yearsOfExperience: intRange("Years of experience", 0, 80),
  citiesServed: z.array(z.enum(SUPPORTED_CITIES)).min(1, "Pick at least one city"),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
  licenseDocUrl: assetUrl.optional().or(z.literal("")),
  about: z.string().trim().max(2000).optional(),
});
export type BuilderProfileInput = z.input<typeof builderProfileSchema>;

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(120),
  city: z.string().trim().min(2, "Enter the city").max(60),
  areaSqft: intRange("Area", 100, 100_000),
  completedYear: intRange("Year", 1980, new Date().getFullYear()),
  description: z.string().trim().max(1000).optional(),
  imageUrls: z.array(assetUrl).min(1, "Upload at least one photo").max(10),
});
export type PortfolioItemInput = z.input<typeof portfolioItemSchema>;

export const verifyBuilderSchema = z
  .object({
    builderId: idSchema,
    decision: z.enum(["VERIFIED", "REJECTED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === "VERIFIED" || (v.reason && v.reason.length >= 5), {
    message: "Give a reason (at least 5 characters) when rejecting",
    path: ["reason"],
  });
