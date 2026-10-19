import type { Package } from "@prisma/client";
import type { BreakdownPercents } from "../lib/estimator";

// TODO: replace with real market rates. These are PLACEHOLDER values for demo only.
export const STANDARD_SPLIT: BreakdownPercents = {
  foundation: 12, structure: 22, masonry: 10, plastering: 6, waterproofing: 3, plumbing: 7,
  electrical: 7, flooring: 11, painting: 6, doorsWindows: 9, fixtures: 4, miscellaneous: 3,
};
export const FINISH_HEAVY_SPLIT: BreakdownPercents = {
  foundation: 11, structure: 19, masonry: 8, plastering: 6, waterproofing: 3, plumbing: 7,
  electrical: 7, flooring: 13, painting: 7, doorsWindows: 10, fixtures: 6, miscellaneous: 3,
};
export const PLACEHOLDER_RATES: Record<string, Record<Package, [number, number]>> = {
  // TODO: replace with real market rates (₹ per sqft of built-up area).
  Bengaluru: { BASIC: [1750, 1950], STANDARD: [2050, 2300], PREMIUM: [2400, 2750], LUXURY: [2950, 3600] },
  // TODO: replace with real market rates.
  Mysuru: { BASIC: [1600, 1800], STANDARD: [1900, 2150], PREMIUM: [2250, 2550], LUXURY: [2750, 3300] },
};
export const splitFor = (p: Package) => (p === "PREMIUM" || p === "LUXURY" ? FINISH_HEAVY_SPLIT : STANDARD_SPLIT);
