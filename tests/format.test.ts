import { describe, expect, it } from "vitest";
import { floorsLabel, formatINR, formatINRCompact } from "@/lib/format";

describe("formatINR", () => {
  it.each([
    [0, "₹0"],
    [999, "₹999"],
    [1000, "₹1,000"],
    [100000, "₹1,00,000"],
    [1250000, "₹12,50,000"],
    [123456789, "₹12,34,56,789"],
    [-45000, "-₹45,000"],
  ])("formats %d as %s", (n, s) => expect(formatINR(n)).toBe(s));

  it("compacts lakhs and crores", () => {
    expect(formatINRCompact(4_550_000)).toBe("₹45.5 L");
    expect(formatINRCompact(23_000_000)).toBe("₹2.3 Cr");
  });

  it("labels floors", () => {
    expect(floorsLabel(1)).toBe("G");
    expect(floorsLabel(3)).toBe("G+2");
  });
});
