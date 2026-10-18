import { z } from "zod";
import { DEFAULT_ESTIMATOR_CONFIG } from "@/lib/estimator/config";
import { citySchema, intRange, packageSchema } from "./common";

export const extrasSchema = z.object({
  basement: z.boolean(),
  lift: z.boolean(),
  compoundWall: z.boolean(),
  sump: z.boolean(),
  solar: z.boolean(),
});

export const estimateInputSchema = z
  .object({
    city: citySchema,
    builtUpAreaSqft: intRange("Built-up area", DEFAULT_ESTIMATOR_CONFIG.minAreaSqft, DEFAULT_ESTIMATOR_CONFIG.maxAreaSqft),
    floors: intRange("Floors", 1, DEFAULT_ESTIMATOR_CONFIG.maxFloors),
    package: packageSchema,
    extras: extrasSchema,
  })
  .refine((v) => !v.extras.lift || v.floors >= 2, { message: "A lift needs at least G+1", path: ["extras", "lift"] });
export type EstimateFormInput = z.infer<typeof estimateInputSchema>;
