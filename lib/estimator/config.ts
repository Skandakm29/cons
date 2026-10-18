import type { ExtraKey, PackageTier, PaymentMilestone } from "./types";

/**
 * Tunable estimator factors. ₹/sqft package rates are NOT here; they live in the
 * EstimatorRate table (admin-editable, seeded in prisma/seed.ts).
 */
export interface EstimatorConfig {
  minAreaSqft: number;
  maxAreaSqft: number;
  maxFloors: number;
  /** Multiplier on base cost by number of storeys (index 1 = G). */
  floorMultipliers: Record<number, number>;
  /** Added per storey beyond the highest configured entry. */
  floorMultiplierStep: number;
  extras: {
    /** Basement cost = footprint sqft × package rate × this factor. */
    basementRateFactor: number;
    /** Lump-sum extras in ₹. TODO: replace with real market prices. */
    lumpSum: Record<Exclude<ExtraKey, "basement">, { low: number; high: number }>;
    /** Lift cost increase per storey above G+1. */
    liftPerExtraFloor: { low: number; high: number };
  };
  timeline: {
    baseWeeks: number;
    perAdditionalFloorWeeks: number;
    per1000SqftWeeks: number;
    extrasWeeks: Partial<Record<ExtraKey, number>>;
    packageWeeks: Record<PackageTier, number>;
  };
  milestones: {
    head: PaymentMilestone[];
    /** Total % reserved for slab milestones; split across floors. */
    slabsPercent: number;
    tail: PaymentMilestone[];
  };
  packageBlurbs: Record<PackageTier, string>;
}

export const DEFAULT_ESTIMATOR_CONFIG: EstimatorConfig = {
  minAreaSqft: 300,
  maxAreaSqft: 20000,
  maxFloors: 5,
  floorMultipliers: { 1: 1.0, 2: 1.03, 3: 1.06, 4: 1.1, 5: 1.15 },
  floorMultiplierStep: 0.05,
  extras: {
    basementRateFactor: 1.3,
    // TODO: replace with real market prices.
    lumpSum: {
      lift: { low: 750_000, high: 1_200_000 },
      compoundWall: { low: 150_000, high: 250_000 },
      sump: { low: 80_000, high: 150_000 },
      solar: { low: 150_000, high: 250_000 },
    },
    liftPerExtraFloor: { low: 50_000, high: 80_000 },
  },
  timeline: {
    baseWeeks: 20,
    perAdditionalFloorWeeks: 8,
    per1000SqftWeeks: 2,
    extrasWeeks: { basement: 6, lift: 2, compoundWall: 1 },
    packageWeeks: { BASIC: 0, STANDARD: 0, PREMIUM: 2, LUXURY: 4 },
  },
  milestones: {
    head: [
      { name: "Booking & agreement", percent: 10 },
      { name: "Foundation", percent: 15 },
      { name: "Plinth beam", percent: 10 },
    ],
    slabsPercent: 30,
    tail: [
      { name: "Brickwork & plastering", percent: 15 },
      { name: "Flooring, fixtures & painting", percent: 15 },
      { name: "Handover", percent: 5 },
    ],
  },
  packageBlurbs: {
    BASIC: "Lowest cost with dependable standard materials — good for rental or budget builds.",
    STANDARD: "Best value for most families: branded cement/steel and mid-range finishes.",
    PREMIUM: "Upgraded finishes (vitrified/granite, premium paint, UPVC windows) for a long-term home.",
    LUXURY: "Top-tier brands, Italian marble options and custom detailing throughout.",
  },
};
