export const PACKAGES = ["BASIC", "STANDARD", "PREMIUM", "LUXURY"] as const;
export type PackageTier = (typeof PACKAGES)[number];

export const BREAKDOWN_CATEGORIES = [
  "foundation",
  "structure",
  "masonry",
  "plastering",
  "waterproofing",
  "plumbing",
  "electrical",
  "flooring",
  "painting",
  "doorsWindows",
  "fixtures",
  "miscellaneous",
] as const;
export type BreakdownCategory = (typeof BREAKDOWN_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<BreakdownCategory, string> = {
  foundation: "Foundation & excavation",
  structure: "RCC structure (columns, beams, slabs)",
  masonry: "Masonry / brickwork",
  plastering: "Plastering",
  waterproofing: "Waterproofing",
  plumbing: "Plumbing & sanitary",
  electrical: "Electrical",
  flooring: "Flooring & tiling",
  painting: "Painting",
  doorsWindows: "Doors & windows",
  fixtures: "Kitchen & bath fixtures",
  miscellaneous: "Miscellaneous & site overheads",
};

export type BreakdownPercents = Record<BreakdownCategory, number>;

/** One row of EstimatorRate for a city and package. */
export interface PackageRate {
  package: PackageTier;
  ratePerSqftLow: number;
  ratePerSqftHigh: number;
  breakdownPercents: BreakdownPercents;
}

export const EXTRA_KEYS = ["basement", "lift", "compoundWall", "sump", "solar"] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];
export type EstimatorExtras = Record<ExtraKey, boolean>;

export const EXTRA_LABELS: Record<ExtraKey, string> = {
  basement: "Basement / cellar",
  lift: "Home lift",
  compoundWall: "Compound wall & gate",
  sump: "Underground sump",
  solar: "Solar panels + water heater",
};

export interface EstimatorInput {
  city: string;
  builtUpAreaSqft: number;
  /** Above-ground storeys: 1 = G, 2 = G+1 ... */
  floors: number;
  package: PackageTier;
  extras?: Partial<EstimatorExtras>;
  /** Optional homeowner budget ceiling (₹) used for the package recommendation. */
  budgetMax?: number;
}

export interface BreakdownLine {
  category: BreakdownCategory;
  label: string;
  percent: number;
  amountLow: number;
  amountHigh: number;
}

export interface ExtraLine {
  key: ExtraKey;
  label: string;
  amountLow: number;
  amountHigh: number;
}

export interface PaymentMilestone {
  name: string;
  percent: number;
}

export interface RecommendedPlan {
  suggestedPackage: PackageTier;
  reason: string;
  timelineWeeks: number;
  paymentMilestones: PaymentMilestone[];
}

export interface EstimateBreakdown {
  floorMultiplier: number;
  baseLow: number;
  baseHigh: number;
  categories: BreakdownLine[];
  extras: ExtraLine[];
  extrasLow: number;
  extrasHigh: number;
}

export interface EstimateResult extends EstimateBreakdown {
  city: string;
  package: PackageTier;
  builtUpAreaSqft: number;
  floors: number;
  ratePerSqftLow: number;
  ratePerSqftHigh: number;
  totalLow: number;
  totalHigh: number;
  recommendedPlan: RecommendedPlan;
}

export class EstimatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimatorError";
  }
}
