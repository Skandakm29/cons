import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EstimateCalculator } from "@/components/estimate/estimate-calculator";

export const metadata: Metadata = { title: "Construction cost calculator" };

export default function EstimatePage() {
  return (
    <div className="container max-w-5xl py-8">
      <PageHeader
        title="House construction cost calculator"
        description="A free benchmark based on current per-sqft rates in your city. No login needed."
      />
      <EstimateCalculator />
    </div>
  );
}
