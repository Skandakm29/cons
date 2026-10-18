/**
 * Zod parsers for Prisma Json columns, so JSON read from the DB is typed (never `any`).
 */
import { z } from "zod";
import { BREAKDOWN_CATEGORIES, EXTRA_KEYS, PACKAGES } from "@/lib/estimator/types";
import type { EstimateBreakdown, PackageRate, RecommendedPlan } from "@/lib/estimator/types";
import { breakdownAmountsSchema, breakdownPercentsSchema } from "./common";
import { materialsSpecSchema } from "./bid";

const milestone = z.object({ name: z.string(), percent: z.number() });

const estimateBreakdownJson = z.object({
  floorMultiplier: z.number(),
  baseLow: z.number(),
  baseHigh: z.number(),
  categories: z.array(
    z.object({
      category: z.enum(BREAKDOWN_CATEGORIES),
      label: z.string(),
      percent: z.number(),
      amountLow: z.number(),
      amountHigh: z.number(),
    }),
  ),
  extras: z.array(z.object({ key: z.enum(EXTRA_KEYS), label: z.string(), amountLow: z.number(), amountHigh: z.number() })),
  extrasLow: z.number(),
  extrasHigh: z.number(),
});

const recommendedPlanJson = z.object({
  suggestedPackage: z.enum(PACKAGES),
  reason: z.string(),
  timelineWeeks: z.number(),
  paymentMilestones: z.array(milestone),
});

export const parseEstimateBreakdown = (v: unknown): EstimateBreakdown => estimateBreakdownJson.parse(v);
export const parseRecommendedPlan = (v: unknown): RecommendedPlan => recommendedPlanJson.parse(v);
export const parseBidBreakdown = (v: unknown) => breakdownAmountsSchema.parse(v);
export const parseMaterialsSpec = (v: unknown) => materialsSpecSchema.parse(v);
export const parseMilestones = (v: unknown) => z.array(milestone).parse(v);

export function parseRate(row: {
  package: (typeof PACKAGES)[number];
  ratePerSqftLow: number;
  ratePerSqftHigh: number;
  breakdownPercents: unknown;
}): PackageRate {
  return {
    package: row.package,
    ratePerSqftLow: row.ratePerSqftLow,
    ratePerSqftHigh: row.ratePerSqftHigh,
    breakdownPercents: breakdownPercentsSchema.parse(row.breakdownPercents),
  };
}

export type NotificationPayload = { title: string; body: string; href?: string };
export const parseNotificationPayload = (v: unknown): NotificationPayload =>
  z.object({ title: z.string(), body: z.string(), href: z.string().optional() }).parse(v);
