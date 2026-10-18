import { BUSINESS_RULES } from "../config";

export type PriceBand = "WITHIN" | "ABOVE" | "BELOW" | "UNUSUALLY_LOW";

/**
 * Classifies a bid price against the benchmark range.
 * UNUSUALLY_LOW means more than `threshold` (fraction) below the low end.
 */
export function classifyBidPrice(
  price: number,
  low: number,
  high: number,
  threshold: number = BUSINESS_RULES.unusuallyLowThreshold,
): PriceBand {
  if (price < low * (1 - threshold)) return "UNUSUALLY_LOW";
  if (price < low) return "BELOW";
  if (price > high) return "ABOVE";
  return "WITHIN";
}

/** Signed % difference vs the benchmark midpoint, rounded to one decimal. */
export function diffVsBenchmarkPercent(price: number, low: number, high: number): number {
  const mid = (low + high) / 2;
  return Math.round(((price - mid) / mid) * 1000) / 10;
}
