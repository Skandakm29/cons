"use server";

import { calculateEstimate, EstimatorError, type EstimateResult } from "@/lib/estimator";
import { getRatesForCity } from "@/lib/services/estimates";
import { estimateInputSchema } from "@/lib/validation/estimate";
import { ActionError, runAction, type ActionResult } from "./result";

/** Public: powers the /estimate calculator (no login required). */
export async function calculateEstimateAction(input: unknown): Promise<ActionResult<EstimateResult>> {
  return runAction(async () => {
    const v = estimateInputSchema.parse(input);
    const rates = await getRatesForCity(v.city);
    try {
      return calculateEstimate(v, rates);
    } catch (e) {
      if (e instanceof EstimatorError) throw new ActionError(e.message);
      throw e;
    }
  });
}
