import { CalendarClock, Lightbulb, Wallet } from "lucide-react";
import type { EstimateBreakdown, PackageTier, RecommendedPlan } from "@/lib/estimator/types";
import { formatINR, formatINRCompact, humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface EstimateView {
  package: PackageTier;
  ratePerSqftLow: number;
  ratePerSqftHigh: number;
  totalLow: number;
  totalHigh: number;
  breakdown: EstimateBreakdown;
  recommendedPlan: RecommendedPlan;
}

/** Our benchmark price card: total range, BOQ-style breakdown chart, and recommended plan. */
export function EstimateCard({ estimate, title = "Our price benchmark" }: { estimate: EstimateView; title?: string }) {
  const { breakdown: b, recommendedPlan: plan } = estimate;
  const maxPct = Math.max(...b.categories.map((c) => c.percent));
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-accent/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">{humanize(estimate.package)} package</Badge>
        </div>
        <p className="text-3xl font-bold text-primary">
          {formatINRCompact(estimate.totalLow)} – {formatINRCompact(estimate.totalHigh)}
        </p>
        <CardDescription>
          {formatINR(estimate.totalLow)} to {formatINR(estimate.totalHigh)} · {formatINR(estimate.ratePerSqftLow)}–
          {formatINR(estimate.ratePerSqftHigh)}/sqft
          {b.floorMultiplier !== 1 && ` · ×${b.floorMultiplier} multi-floor factor`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 sm:pt-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="breakdown-heading">
          <h4 id="breakdown-heading" className="mb-3 text-sm font-semibold">
            Cost breakdown (BOQ categories)
          </h4>
          <ul className="space-y-2.5">
            {b.categories.map((c) => (
              <li key={c.category} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span>{c.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {c.percent}% · {formatINRCompact(c.amountLow)}–{formatINRCompact(c.amountHigh)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
                  <div className="h-2 rounded-full bg-primary/80" style={{ width: `${(c.percent / maxPct) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {b.extras.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-sm font-semibold">Extras</h4>
              <ul className="divide-y rounded-md border text-sm">
                {b.extras.map((e) => (
                  <li key={e.key} className="flex justify-between gap-2 px-3 py-2">
                    <span>{e.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatINR(e.amountLow)} – {formatINR(e.amountHigh)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="space-y-4 lg:col-span-2" aria-labelledby="plan-heading">
          <h4 id="plan-heading" className="text-sm font-semibold">
            Our recommended plan
          </h4>
          <div className="flex gap-3 rounded-md border bg-muted/40 p-3 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p>
              <strong>{humanize(plan.suggestedPackage)} package.</strong> {plan.reason}
            </p>
          </div>
          <div className="flex gap-3 rounded-md border bg-muted/40 p-3 text-sm">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p>
              About <strong>{plan.timelineWeeks} weeks</strong> (~{Math.round(plan.timelineWeeks / 4.3)} months) from
              foundation to handover.
            </p>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Wallet className="h-4 w-4 text-primary" aria-hidden /> Milestone payment schedule
            </p>
            <ol className="space-y-1">
              {plan.paymentMilestones.map((m, i) => (
                <li key={m.name} className="flex justify-between gap-2">
                  <span>
                    {i + 1}. {m.name}
                  </span>
                  <span className="tabular-nums font-medium">{m.percent}%</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
