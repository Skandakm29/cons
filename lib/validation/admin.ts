import { z } from "zod";
import { breakdownPercentsSchema, citySchema, idSchema, intRange, packageSchema } from "./common";

export const rateSchema = z
  .object({
    city: citySchema,
    package: packageSchema,
    ratePerSqftLow: intRange("Low rate", 100, 50_000),
    ratePerSqftHigh: intRange("High rate", 100, 50_000),
    breakdownPercents: breakdownPercentsSchema,
  })
  .refine((v) => v.ratePerSqftHigh >= v.ratePerSqftLow, { message: "High must be ≥ low", path: ["ratePerSqftHigh"] });
export type RateInput = z.infer<typeof rateSchema>;

export const moderateProjectSchema = z.object({
  projectId: idSchema,
  action: z.enum(["CANCEL", "REOPEN"]),
  note: z.string().trim().min(5, "Add a moderation note").max(500),
});

export const moderateBidSchema = z.object({
  bidId: idSchema,
  note: z.string().trim().min(5, "Add a moderation note").max(500),
});
