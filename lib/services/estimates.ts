import type { Prisma, Project } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculateEstimate, type EstimateResult, type EstimatorInput, type PackageRate } from "@/lib/estimator";
import { toJson } from "@/lib/json";
import { parseEstimateBreakdown, parseRate, parseRecommendedPlan } from "@/lib/validation/json";

export async function getRatesForCity(city: string): Promise<PackageRate[]> {
  const rows = await prisma.estimatorRate.findMany({ where: { city } });
  return rows.map(parseRate);
}

export function projectToEstimatorInput(
  p: Pick<
    Project,
    | "city" | "builtUpAreaSqft" | "floors" | "preferredPackage" | "budgetMax"
    | "extraBasement" | "extraLift" | "extraCompoundWall" | "extraSump" | "extraSolar"
  >,
): EstimatorInput {
  return {
    city: p.city,
    builtUpAreaSqft: p.builtUpAreaSqft,
    floors: p.floors,
    package: p.preferredPackage,
    budgetMax: p.budgetMax,
    extras: {
      basement: p.extraBasement,
      lift: p.extraLift,
      compoundWall: p.extraCompoundWall,
      sump: p.extraSump,
      solar: p.extraSolar,
    },
  };
}

export function estimateToCreateData(result: EstimateResult): Omit<Prisma.EstimateUncheckedCreateInput, "projectId"> {
  const { categories, extras, extrasLow, extrasHigh, floorMultiplier, baseLow, baseHigh, recommendedPlan } = result;
  return {
    package: result.package,
    ratePerSqftLow: result.ratePerSqftLow,
    ratePerSqftHigh: result.ratePerSqftHigh,
    totalLow: result.totalLow,
    totalHigh: result.totalHigh,
    breakdown: toJson({ floorMultiplier, baseLow, baseHigh, categories, extras, extrasLow, extrasHigh }),
    recommendedPlan: toJson(recommendedPlan),
  };
}

export async function createEstimateForProject(project: Project, tx: Prisma.TransactionClient = prisma) {
  const rates = await getRatesForCity(project.city);
  const result = calculateEstimate(projectToEstimatorInput(project), rates);
  return tx.estimate.create({ data: { projectId: project.id, ...estimateToCreateData(result) } });
}

export async function getLatestEstimate(projectId: string) {
  const e = await prisma.estimate.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
  if (!e) return null;
  return { ...e, breakdown: parseEstimateBreakdown(e.breakdown), recommendedPlan: parseRecommendedPlan(e.recommendedPlan) };
}
export type ParsedEstimate = NonNullable<Awaited<ReturnType<typeof getLatestEstimate>>>;
