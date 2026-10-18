import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { classifyBidPrice, diffVsBenchmarkPercent, type PriceBand } from "@/lib/estimator/benchmark";

const META: Record<PriceBand, { label: string; variant: "success" | "warning" | "danger" | "info" }> = {
  WITHIN: { label: "Within benchmark", variant: "success" },
  ABOVE: { label: "Above benchmark", variant: "warning" },
  BELOW: { label: "Below benchmark", variant: "info" },
  UNUSUALLY_LOW: { label: "Unusually low", variant: "danger" },
};

export function PriceBandBadge({ price, low, high }: { price: number; low: number; high: number }) {
  const band = classifyBidPrice(price, low, high);
  const diff = diffVsBenchmarkPercent(price, low, high);
  const { label, variant } = META[band];
  return (
    <Badge variant={variant} title={`${diff > 0 ? "+" : ""}${diff}% vs benchmark midpoint`}>
      {band === "UNUSUALLY_LOW" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
      {label} ({diff > 0 ? "+" : ""}
      {diff}%)
    </Badge>
  );
}

export function UnusuallyLowWarning({ price, low, high }: { price: number; low: number; high: number }) {
  if (classifyBidPrice(price, low, high) !== "UNUSUALLY_LOW") return null;
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium text-red-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      Unusually low — ask for a detailed BOQ before deciding.
    </p>
  );
}
