import { z } from "zod";
import { DEFAULT_ESTIMATOR_CONFIG } from "@/lib/estimator/config";
import { citySchema, intRange, packageSchema, rupees } from "./common";
import { extrasSchema } from "./estimate";

export const FACINGS = [
  "NORTH", "EAST", "SOUTH", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST",
] as const;

export const START_TIMELINES = ["Immediately", "Within 1 month", "1–3 months", "3–6 months", "Just exploring"] as const;

export const plotStepSchema = z.object({
  title: z.string().trim().min(4, "Give your project a short title").max(100),
  city: citySchema,
  locality: z.string().trim().min(2, "Enter the locality").max(80),
  plotLengthFt: intRange("Plot length", 10, 500),
  plotWidthFt: intRange("Plot width", 10, 500),
  facing: z.enum(FACINGS),
});

export const requirementsStepSchema = z.object({
  builtUpAreaSqft: intRange("Built-up area", DEFAULT_ESTIMATOR_CONFIG.minAreaSqft, DEFAULT_ESTIMATOR_CONFIG.maxAreaSqft),
  floors: intRange("Floors", 1, DEFAULT_ESTIMATOR_CONFIG.maxFloors),
  bedrooms: intRange("Bedrooms", 1, 20),
  bathrooms: intRange("Bathrooms", 1, 20),
  parking: z.boolean(),
  vastuRequired: z.boolean(),
  preferredPackage: packageSchema,
  extras: extrasSchema,
});

export const budgetStepSchema = z.object({
  budgetMin: rupees("Minimum budget"),
  budgetMax: rupees("Maximum budget"),
  startTimeline: z.enum(START_TIMELINES),
  notes: z.string().trim().max(2000).optional(),
});

export const projectSchema = plotStepSchema
  .merge(requirementsStepSchema)
  .merge(budgetStepSchema)
  .extend({ publish: z.boolean() })
  .superRefine((v, ctx) => {
    if (v.budgetMin > v.budgetMax) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Maximum must be at least the minimum" });
    }
    if (v.budgetMax < 100_000) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "Budget looks too low for a house" });
    }
    const plotArea = v.plotLengthFt * v.plotWidthFt;
    // Sanity check: built-up area can't exceed the plot footprint times the number of floors.
    if (v.builtUpAreaSqft > plotArea * v.floors) {
      ctx.addIssue({
        code: "custom",
        path: ["builtUpAreaSqft"],
        message: `Built-up area can't exceed plot area × floors (${plotArea * v.floors} sqft)`,
      });
    }
    if (v.extras.lift && v.floors < 2) {
      ctx.addIssue({ code: "custom", path: ["extras", "lift"], message: "A lift needs at least G+1" });
    }
  });
export type ProjectInput = z.infer<typeof projectSchema>;

export const projectFiltersSchema = z.object({
  city: citySchema.optional().catch(undefined),
  package: packageSchema.optional().catch(undefined),
  minArea: z.coerce.number().int().positive().optional().catch(undefined),
  maxArea: z.coerce.number().int().positive().optional().catch(undefined),
  minBudget: z.coerce.number().int().positive().optional().catch(undefined),
  maxBudget: z.coerce.number().int().positive().optional().catch(undefined),
});
