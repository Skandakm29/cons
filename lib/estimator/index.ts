import { DEFAULT_ESTIMATOR_CONFIG, type EstimatorConfig } from "./config";
import {
  BREAKDOWN_CATEGORIES,
  CATEGORY_LABELS,
  EXTRA_KEYS,
  EXTRA_LABELS,
  EstimatorError,
  PACKAGES,
  type BreakdownCategory,
  type BreakdownLine,
  type BreakdownPercents,
  type EstimateResult,
  type EstimatorExtras,
  type EstimatorInput,
  type ExtraLine,
  type PackageRate,
  type PackageTier,
  type PaymentMilestone,
  type RecommendedPlan,
} from "./types";

export * from "./types";
export * from "./benchmark";
export { DEFAULT_ESTIMATOR_CONFIG, type EstimatorConfig } from "./config";

const PERCENT_TOLERANCE = 0.01;

export function floorMultiplier(floors: number, config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG): number {
  const configured = config.floorMultipliers[floors];
  if (configured !== undefined) return configured;
  const keys = Object.keys(config.floorMultipliers).map(Number);
  const maxKey = Math.max(...keys);
  return config.floorMultipliers[maxKey] + (floors - maxKey) * config.floorMultiplierStep;
}

export function validateBreakdownPercents(percents: BreakdownPercents): void {
  let sum = 0;
  for (const c of BREAKDOWN_CATEGORIES) {
    const v = percents[c];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new EstimatorError(`Breakdown percent for "${c}" is missing or invalid`);
    }
    sum += v;
  }
  if (Math.abs(sum - 100) > PERCENT_TOLERANCE) {
    throw new EstimatorError(`Breakdown percents must sum to 100 (got ${sum})`);
  }
}

/**
 * Splits an integer total across categories by percent using the largest-remainder
 * method, so the parts are whole rupees and always add up exactly to the total.
 */
export function distributeByPercents(total: number, percents: BreakdownPercents): Record<BreakdownCategory, number> {
  const raw = BREAKDOWN_CATEGORIES.map((c) => ({ c, exact: (total * percents[c]) / 100 }));
  const floored = raw.map((r) => ({ ...r, value: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let leftover = total - floored.reduce((s, r) => s + r.value, 0);
  const byRemainder = [...floored].sort((a, b) => b.rem - a.rem);
  for (const r of byRemainder) {
    if (leftover <= 0) break;
    r.value += 1;
    leftover -= 1;
  }
  const out = {} as Record<BreakdownCategory, number>;
  for (const r of floored) out[r.c] = r.value;
  return out;
}

function validateInput(input: EstimatorInput, rate: PackageRate | undefined, config: EstimatorConfig): asserts rate is PackageRate {
  const { builtUpAreaSqft: area, floors } = input;
  if (!input.city || !input.city.trim()) throw new EstimatorError("City is required");
  if (!PACKAGES.includes(input.package)) throw new EstimatorError(`Unknown package "${input.package}"`);
  if (!Number.isFinite(area) || area < config.minAreaSqft || area > config.maxAreaSqft) {
    throw new EstimatorError(`Built-up area must be between ${config.minAreaSqft} and ${config.maxAreaSqft} sqft`);
  }
  if (!Number.isInteger(floors) || floors < 1 || floors > config.maxFloors) {
    throw new EstimatorError(`Floors must be a whole number between 1 (G) and ${config.maxFloors}`);
  }
  if (input.extras?.lift && floors < 2) throw new EstimatorError("A lift needs at least G+1 floors");
  if (input.budgetMax !== undefined && (!Number.isFinite(input.budgetMax) || input.budgetMax <= 0)) {
    throw new EstimatorError("Budget must be a positive amount");
  }
  if (!rate) throw new EstimatorError(`No ${input.package} rates configured for ${input.city}`);
  if (rate.ratePerSqftLow <= 0 || rate.ratePerSqftHigh < rate.ratePerSqftLow) {
    throw new EstimatorError("Invalid rate configuration: low must be positive and not exceed high");
  }
  validateBreakdownPercents(rate.breakdownPercents);
}

function computeExtras(
  extras: EstimatorExtras,
  input: EstimatorInput,
  rate: PackageRate,
  config: EstimatorConfig,
): ExtraLine[] {
  const lines: ExtraLine[] = [];
  const footprint = input.builtUpAreaSqft / input.floors;
  for (const key of EXTRA_KEYS) {
    if (!extras[key]) continue;
    let low: number;
    let high: number;
    if (key === "basement") {
      low = footprint * rate.ratePerSqftLow * config.extras.basementRateFactor;
      high = footprint * rate.ratePerSqftHigh * config.extras.basementRateFactor;
    } else {
      ({ low, high } = config.extras.lumpSum[key]);
      if (key === "lift" && input.floors > 2) {
        low += (input.floors - 2) * config.extras.liftPerExtraFloor.low;
        high += (input.floors - 2) * config.extras.liftPerExtraFloor.high;
      }
    }
    lines.push({ key, label: EXTRA_LABELS[key], amountLow: Math.round(low), amountHigh: Math.round(high) });
  }
  return lines;
}

function normaliseExtras(extras: Partial<EstimatorExtras> | undefined): EstimatorExtras {
  return {
    basement: !!extras?.basement,
    lift: !!extras?.lift,
    compoundWall: !!extras?.compoundWall,
    sump: !!extras?.sump,
    solar: !!extras?.solar,
  };
}

export function estimateTimelineWeeks(
  input: Pick<EstimatorInput, "builtUpAreaSqft" | "floors" | "package" | "extras">,
  config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG,
): number {
  const t = config.timeline;
  const extras = normaliseExtras(input.extras);
  let weeks =
    t.baseWeeks +
    (input.floors - 1) * t.perAdditionalFloorWeeks +
    Math.ceil(input.builtUpAreaSqft / 1000) * t.per1000SqftWeeks +
    t.packageWeeks[input.package];
  for (const key of EXTRA_KEYS) if (extras[key]) weeks += t.extrasWeeks[key] ?? 0;
  return weeks;
}

/** Default 7–8 step schedule; slab payments scale with the number of floors. Always sums to 100. */
export function defaultPaymentMilestones(
  floors: number,
  config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG,
): PaymentMilestone[] {
  const m = config.milestones;
  let slabs: PaymentMilestone[];
  if (floors <= 1) {
    slabs = [{ name: "Roof slab", percent: m.slabsPercent }];
  } else if (floors === 2) {
    const first = Math.ceil(m.slabsPercent / 2);
    slabs = [
      { name: "Ground floor slab", percent: first },
      { name: "First floor (roof) slab", percent: m.slabsPercent - first },
    ];
  } else {
    const first = Math.round(m.slabsPercent / 3);
    slabs = [
      { name: "Ground floor slab", percent: first },
      { name: `Upper floor slabs (${floors - 1})`, percent: m.slabsPercent - first },
    ];
  }
  return [...m.head, ...slabs, ...m.tail].map((x) => ({ ...x }));
}

function packageTotals(
  input: EstimatorInput,
  rate: PackageRate,
  extras: EstimatorExtras,
  config: EstimatorConfig,
): { low: number; high: number } {
  const mult = floorMultiplier(input.floors, config);
  const extraLines = computeExtras(extras, input, rate, config);
  const eLow = extraLines.reduce((s, l) => s + l.amountLow, 0);
  const eHigh = extraLines.reduce((s, l) => s + l.amountHigh, 0);
  return {
    low: Math.round(input.builtUpAreaSqft * rate.ratePerSqftLow * mult) + eLow,
    high: Math.round(input.builtUpAreaSqft * rate.ratePerSqftHigh * mult) + eHigh,
  };
}

export function recommendPlan(
  input: EstimatorInput,
  rates: PackageRate[],
  config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG,
): RecommendedPlan {
  const extras = normaliseExtras(input.extras);
  const preferred = input.package;
  let suggested: PackageTier = preferred;
  let reason = config.packageBlurbs[preferred];

  const budget = input.budgetMax;
  const rateFor = (p: PackageTier) => rates.find((r) => r.package === p);
  const prefRate = rateFor(preferred);

  if (budget !== undefined && prefRate) {
    const pref = packageTotals(input, prefRate, extras, config);
    const prefMid = (pref.low + pref.high) / 2;
    if (pref.high <= budget) {
      reason = `Your budget covers the ${preferred.toLowerCase()} package even at the top of our range.`;
    } else if (prefMid <= budget) {
      reason = `${cap(preferred)} fits your budget, but keep a 10% buffer — quotes at the high end may exceed it.`;
    } else {
      const cheaper = PACKAGES.slice(0, PACKAGES.indexOf(preferred)).reverse();
      const fit = cheaper.find((p) => {
        const r = rateFor(p);
        if (!r) return false;
        const t = packageTotals(input, r, extras, config);
        return (t.low + t.high) / 2 <= budget;
      });
      if (fit) {
        suggested = fit;
        reason = `Your budget is closer to the ${fit.toLowerCase()} package; ${preferred.toLowerCase()} would likely exceed it.`;
      } else {
        suggested = PACKAGES[0];
        reason = "Your budget is below our benchmark for this size — consider a smaller built-up area or fewer floors.";
      }
    }
  }

  return {
    suggestedPackage: suggested,
    reason,
    timelineWeeks: estimateTimelineWeeks({ ...input, package: suggested }, config),
    paymentMilestones: defaultPaymentMilestones(input.floors, config),
  };
}

/**
 * Computes the benchmark cost range for a project.
 * @param rates all package rates for the input city (the selected package must be present).
 */
export function calculateEstimate(
  input: EstimatorInput,
  rates: PackageRate[],
  config: EstimatorConfig = DEFAULT_ESTIMATOR_CONFIG,
): EstimateResult {
  const rate = rates.find((r) => r.package === input.package);
  validateInput(input, rate, config);

  const extras = normaliseExtras(input.extras);
  const mult = floorMultiplier(input.floors, config);
  const baseLow = Math.round(input.builtUpAreaSqft * rate.ratePerSqftLow * mult);
  const baseHigh = Math.round(input.builtUpAreaSqft * rate.ratePerSqftHigh * mult);

  const lowParts = distributeByPercents(baseLow, rate.breakdownPercents);
  const highParts = distributeByPercents(baseHigh, rate.breakdownPercents);
  const categories: BreakdownLine[] = BREAKDOWN_CATEGORIES.map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c],
    percent: rate.breakdownPercents[c],
    amountLow: lowParts[c],
    amountHigh: highParts[c],
  }));

  const extraLines = computeExtras(extras, input, rate, config);
  const extrasLow = extraLines.reduce((s, l) => s + l.amountLow, 0);
  const extrasHigh = extraLines.reduce((s, l) => s + l.amountHigh, 0);

  return {
    city: input.city,
    package: input.package,
    builtUpAreaSqft: input.builtUpAreaSqft,
    floors: input.floors,
    ratePerSqftLow: rate.ratePerSqftLow,
    ratePerSqftHigh: rate.ratePerSqftHigh,
    floorMultiplier: mult,
    baseLow,
    baseHigh,
    categories,
    extras: extraLines,
    extrasLow,
    extrasHigh,
    totalLow: baseLow + extrasLow,
    totalHigh: baseHigh + extrasHigh,
    recommendedPlan: recommendPlan(input, rates, config),
  };
}

function cap(p: string): string {
  return p.charAt(0) + p.slice(1).toLowerCase();
}
