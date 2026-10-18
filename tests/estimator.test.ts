import { describe, expect, it } from "vitest";
import {
  BREAKDOWN_CATEGORIES,
  DEFAULT_ESTIMATOR_CONFIG,
  EstimatorError,
  calculateEstimate,
  classifyBidPrice,
  defaultPaymentMilestones,
  distributeByPercents,
  floorMultiplier,
  type BreakdownPercents,
  type EstimatorInput,
  type PackageRate,
} from "@/lib/estimator";

// Test fixtures only — not market rates.
const PERCENTS: BreakdownPercents = {
  foundation: 12, structure: 22, masonry: 10, plastering: 6, waterproofing: 3, plumbing: 7,
  electrical: 7, flooring: 11, painting: 6, doorsWindows: 9, fixtures: 4, miscellaneous: 3,
};
const rate = (pkg: PackageRate["package"], low: number, high: number): PackageRate => ({
  package: pkg, ratePerSqftLow: low, ratePerSqftHigh: high, breakdownPercents: PERCENTS,
});
const RATES: PackageRate[] = [
  rate("BASIC", 1000, 1200),
  rate("STANDARD", 1500, 1800),
  rate("PREMIUM", 2000, 2400),
  rate("LUXURY", 3000, 3600),
];
const base: EstimatorInput = { city: "Testpur", builtUpAreaSqft: 1000, floors: 1, package: "STANDARD" };

describe("calculateEstimate — basic calculation", () => {
  it("multiplies area by the package rate range", () => {
    const r = calculateEstimate(base, RATES);
    expect(r.ratePerSqftLow).toBe(1500);
    expect(r.ratePerSqftHigh).toBe(1800);
    expect(r.floorMultiplier).toBe(1);
    expect(r.totalLow).toBe(1_500_000);
    expect(r.totalHigh).toBe(1_800_000);
    expect(r.extras).toHaveLength(0);
  });

  it("breaks the base cost into every category, summing exactly to the base", () => {
    const r = calculateEstimate({ ...base, builtUpAreaSqft: 1333 }, RATES);
    expect(r.categories.map((c) => c.category)).toEqual([...BREAKDOWN_CATEGORIES]);
    expect(r.categories.reduce((s, c) => s + c.amountLow, 0)).toBe(r.baseLow);
    expect(r.categories.reduce((s, c) => s + c.amountHigh, 0)).toBe(r.baseHigh);
    const structure = r.categories.find((c) => c.category === "structure")!;
    expect(structure.percent).toBe(22);
    expect(structure.amountLow).toBeCloseTo(r.baseLow * 0.22, -1);
  });

  it("returns whole-rupee integers", () => {
    const r = calculateEstimate({ ...base, builtUpAreaSqft: 1234, floors: 3 }, RATES);
    for (const n of [r.totalLow, r.totalHigh, ...r.categories.map((c) => c.amountLow)]) {
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("produces a recommended plan with a milestone schedule summing to 100%", () => {
    const r = calculateEstimate({ ...base, floors: 2 }, RATES);
    const plan = r.recommendedPlan;
    expect(plan.suggestedPackage).toBe("STANDARD");
    expect(plan.reason.length).toBeGreaterThan(0);
    expect(plan.timelineWeeks).toBeGreaterThan(0);
    expect(plan.paymentMilestones.length).toBeGreaterThanOrEqual(6);
    expect(plan.paymentMilestones.length).toBeLessThanOrEqual(8);
    expect(plan.paymentMilestones.reduce((s, m) => s + m.percent, 0)).toBe(100);
  });
});

describe("floor multiplier", () => {
  it("uses configured factors per storey", () => {
    expect(floorMultiplier(1)).toBe(1);
    expect(floorMultiplier(2)).toBe(DEFAULT_ESTIMATOR_CONFIG.floorMultipliers[2]);
  });

  it("extrapolates beyond configured floors using the step", () => {
    const cfg = { ...DEFAULT_ESTIMATOR_CONFIG, floorMultipliers: { 1: 1, 2: 1.1 }, floorMultiplierStep: 0.1 };
    expect(floorMultiplier(4, cfg)).toBeCloseTo(1.3);
  });

  it("raises the cost of the same built-up area as floors increase", () => {
    const g = calculateEstimate({ ...base, builtUpAreaSqft: 2000, floors: 1 }, RATES);
    const g2 = calculateEstimate({ ...base, builtUpAreaSqft: 2000, floors: 3 }, RATES);
    const m = DEFAULT_ESTIMATOR_CONFIG.floorMultipliers[3];
    expect(g2.floorMultiplier).toBe(m);
    expect(g2.totalLow).toBe(Math.round(2000 * 1500 * m));
    expect(g2.totalLow).toBeGreaterThan(g.totalLow);
  });

  it("scales slab milestones with floors and keeps 100%", () => {
    for (const floors of [1, 2, 3, 5]) {
      const ms = defaultPaymentMilestones(floors);
      expect(ms.reduce((s, m) => s + m.percent, 0)).toBe(100);
      expect(ms.length).toBeGreaterThanOrEqual(6);
      expect(ms.length).toBeLessThanOrEqual(8);
    }
  });
});

describe("extras", () => {
  it("adds lump-sum extras as line items on top of the base", () => {
    const r = calculateEstimate({ ...base, extras: { sump: true, solar: true } }, RATES);
    const { sump, solar } = DEFAULT_ESTIMATOR_CONFIG.extras.lumpSum;
    expect(r.extras.map((e) => e.key)).toEqual(["sump", "solar"]);
    expect(r.extrasLow).toBe(sump.low + solar.low);
    expect(r.extrasHigh).toBe(sump.high + solar.high);
    expect(r.totalLow).toBe(r.baseLow + sump.low + solar.low);
    // Category breakdown covers the base only.
    expect(r.categories.reduce((s, c) => s + c.amountLow, 0)).toBe(r.baseLow);
  });

  it("prices a basement on the footprint at the package rate", () => {
    const r = calculateEstimate({ ...base, builtUpAreaSqft: 2000, floors: 2, extras: { basement: true } }, RATES);
    const f = DEFAULT_ESTIMATOR_CONFIG.extras.basementRateFactor;
    expect(r.extras[0]).toMatchObject({ key: "basement", amountLow: Math.round(1000 * 1500 * f) });
  });

  it("charges more for a lift serving more floors", () => {
    const two = calculateEstimate({ ...base, floors: 2, extras: { lift: true } }, RATES);
    const four = calculateEstimate({ ...base, floors: 4, extras: { lift: true } }, RATES);
    expect(four.extras[0].amountLow).toBeGreaterThan(two.extras[0].amountLow);
  });

  it("ignores extras set to false", () => {
    const r = calculateEstimate({ ...base, extras: { sump: false, lift: false } }, RATES);
    expect(r.extras).toHaveLength(0);
    expect(r.totalLow).toBe(r.baseLow);
  });
});

describe("invalid input", () => {
  const bad: Array<[string, Partial<EstimatorInput>]> = [
    ["zero area", { builtUpAreaSqft: 0 }],
    ["negative area", { builtUpAreaSqft: -500 }],
    ["NaN area", { builtUpAreaSqft: Number.NaN }],
    ["huge area", { builtUpAreaSqft: 1_000_000 }],
    ["zero floors", { floors: 0 }],
    ["fractional floors", { floors: 1.5 }],
    ["too many floors", { floors: 99 }],
    ["blank city", { city: "  " }],
    ["lift on a single storey", { extras: { lift: true } }],
    ["negative budget", { budgetMax: -1 }],
  ];
  it.each(bad)("rejects %s", (_, patch) => {
    expect(() => calculateEstimate({ ...base, ...patch }, RATES)).toThrow(EstimatorError);
  });

  it("rejects an unknown package", () => {
    expect(() => calculateEstimate({ ...base, package: "GOLD" as never }, RATES)).toThrow(EstimatorError);
  });

  it("rejects a city/package with no configured rate", () => {
    expect(() => calculateEstimate(base, RATES.filter((r) => r.package !== "STANDARD"))).toThrow(/No STANDARD rates/);
  });

  it("rejects misconfigured rates", () => {
    expect(() => calculateEstimate(base, [rate("STANDARD", 2000, 1000)])).toThrow(EstimatorError);
    const broken = { ...rate("STANDARD", 1000, 1200), breakdownPercents: { ...PERCENTS, structure: 50 } };
    expect(() => calculateEstimate(base, [broken])).toThrow(/sum to 100/);
  });
});

describe("recommended package", () => {
  it("keeps the preferred package when the budget covers it", () => {
    const r = calculateEstimate({ ...base, budgetMax: 2_000_000 }, RATES);
    expect(r.recommendedPlan.suggestedPackage).toBe("STANDARD");
  });

  it("steps down to a package the budget can afford", () => {
    const r = calculateEstimate({ ...base, package: "LUXURY", budgetMax: 1_700_000 }, RATES);
    expect(r.recommendedPlan.suggestedPackage).toBe("STANDARD");
  });

  it("falls back to BASIC with advice when nothing fits", () => {
    const r = calculateEstimate({ ...base, budgetMax: 100_000 }, RATES);
    expect(r.recommendedPlan.suggestedPackage).toBe("BASIC");
    expect(r.recommendedPlan.reason).toMatch(/below our benchmark/);
  });
});

describe("distributeByPercents", () => {
  it("always sums to the total", () => {
    for (const total of [1, 7, 99_999, 1_234_567]) {
      const parts = distributeByPercents(total, PERCENTS);
      expect(Object.values(parts).reduce((s, v) => s + v, 0)).toBe(total);
    }
  });
});

describe("classifyBidPrice", () => {
  it("bands prices against the benchmark", () => {
    expect(classifyBidPrice(1_500_000, 1_400_000, 1_600_000)).toBe("WITHIN");
    expect(classifyBidPrice(1_700_000, 1_400_000, 1_600_000)).toBe("ABOVE");
    expect(classifyBidPrice(1_300_000, 1_400_000, 1_600_000)).toBe("BELOW");
    expect(classifyBidPrice(1_000_000, 1_400_000, 1_600_000)).toBe("UNUSUALLY_LOW");
  });
  it("respects a custom threshold", () => {
    expect(classifyBidPrice(1_300_000, 1_400_000, 1_600_000, 0.05)).toBe("UNUSUALLY_LOW");
  });
});
