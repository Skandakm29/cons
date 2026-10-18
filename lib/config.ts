/** Single place to rename the product and tune business rules. */
export const APP_NAME = "BuildBid";
export const APP_TAGLINE = "Verified builder quotes + a fair price benchmark";

/** Cities where we have estimator rates and builders. Bengaluru launches first. */
export const SUPPORTED_CITIES = ["Bengaluru", "Mysuru"] as const;
export type SupportedCity = (typeof SUPPORTED_CITIES)[number];
export const isSupportedCity = (c: string): c is SupportedCity => (SUPPORTED_CITIES as readonly string[]).includes(c);

export const BUSINESS_RULES = {
  /** Days after publishing until bidding closes. */
  defaultBidWindowDays: 7,
  /** Bids more than this fraction below the estimate's totalLow are flagged as unusually low. */
  unusuallyLowThreshold: 0.25,
  /** Maximum number of bids shown side by side on the compare page. */
  maxCompareBids: 4,
  /** OTP validity window and max verification attempts. */
  otpTtlMinutes: 10,
  otpMaxAttempts: 5,
  /** Upload limits. */
  maxUploadBytes: 5 * 1024 * 1024,
} as const;
