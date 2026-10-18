/**
 * Formats whole rupees with Indian digit grouping: 1250000 -> "₹12,50,000".
 * Implemented by hand so output is identical on every runtime regardless of ICU data.
 */
export function formatINR(amount: number, opts: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = opts;
  const rounded = Math.round(amount);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${negative ? "-" : ""}${withSymbol ? "₹" : ""}${grouped}`;
}

/** Compact Indian notation: 1250000 -> "₹12.5 L", 23000000 -> "₹2.3 Cr". */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const trim = (n: number) => (Math.round(n * 10) / 10).toString();
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`;
  return formatINR(amount);
}

export function formatSqft(area: number): string {
  return `${formatINR(area, { withSymbol: false })} sqft`;
}

/** 1 -> "G", 2 -> "G+1", 3 -> "G+2" */
export function floorsLabel(floors: number): string {
  return floors <= 1 ? "G" : `G+${floors - 1}`;
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Shows only the last 4 digits until contact details are unlocked. */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? phone : `${"•".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
