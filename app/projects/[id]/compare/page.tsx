import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { BUSINESS_RULES } from "@/lib/config";
import { BREAKDOWN_CATEGORIES, CATEGORY_LABELS } from "@/lib/estimator/types";
import { getLatestEstimate } from "@/lib/services/estimates";
import { getOwnedProject } from "@/lib/services/projects";
import { formatINR, formatINRCompact, humanize } from "@/lib/format";
import { MATERIAL_FIELDS } from "@/lib/validation/bid";
import { parseBidBreakdown, parseMaterialsSpec, parseMilestones } from "@/lib/validation/json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PriceBandBadge, UnusuallyLowWarning } from "@/components/price-band-badge";
import { BidStatusBadge, VerificationBadge } from "@/components/status-badge";
import { BidActions } from "@/components/projects/bid-actions";
import { DemoPreview } from "@/components/bids/demo-preview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compare bids" };

const SORTS = { price: "Price", timeline: "Timeline", rating: "Rating" } as const;
type SortKey = keyof typeof SORTS;

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; bids?: string | string[] }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requirePageUser(["HOMEOWNER"]);
  const project = await getOwnedProject(id, user);
  if (!project) notFound();

  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "price";
  const requested = (Array.isArray(sp.bids) ? sp.bids : sp.bids ? [sp.bids] : []).flatMap((s) => s.split(","));

  const [estimate, allBids] = await Promise.all([
    getLatestEstimate(project.id),
    prisma.bid.findMany({
      where: { projectId: project.id, status: { not: "WITHDRAWN" } },
      include: { builder: true },
    }),
  ]);
  if (!estimate) notFound();

  const portfolioIds = allBids.flatMap((b) => b.demoPortfolioItemIds);
  const portfolio = await prisma.portfolioItem.findMany({
    where: { id: { in: portfolioIds } },
    select: { id: true, title: true, imageUrls: true, builderId: true },
  });

  // Default selection: shortlisted/awarded first, then cheapest — up to the compare limit.
  const priority = (s: string) => (s === "AWARDED" ? 0 : s === "SHORTLISTED" ? 1 : s === "SUBMITTED" ? 2 : 3);
  const defaultSel = [...allBids].sort((a, b) => priority(a.status) - priority(b.status) || a.totalPrice - b.totalPrice);
  const selectedIds = new Set(
    (requested.length ? allBids.filter((b) => requested.includes(b.id)) : defaultSel)
      .slice(0, BUSINESS_RULES.maxCompareBids)
      .map((b) => b.id),
  );
  const sorters: Record<SortKey, (a: (typeof allBids)[number], b: (typeof allBids)[number]) => number> = {
    price: (a, b) => a.totalPrice - b.totalPrice,
    timeline: (a, b) => a.timelineWeeks - b.timelineWeeks,
    rating: (a, b) => b.builder.avgRating - a.builder.avgRating,
  };
  const bids = allBids
    .filter((b) => selectedIds.has(b.id))
    .sort(sorters[sort])
    .map((b) => ({
      ...b,
      breakdown: parseBidBreakdown(b.breakdown),
      materials: parseMaterialsSpec(b.materialsSpec),
      milestones: parseMilestones(b.paymentMilestones),
      portfolio: portfolio.filter((p) => b.demoPortfolioItemIds.includes(p.id) && p.builderId === b.builderId),
    }));
  const canDecide = project.status === "OPEN" || project.status === "UNDER_REVIEW";
  const qs = (s: SortKey) => `?sort=${s}${requested.length ? `&bids=${[...selectedIds].join(",")}` : ""}`;

  // Highlight the best value in a row.
  const minPrice = Math.min(...bids.map((b) => b.totalPrice));
  const minWeeks = Math.min(...bids.map((b) => b.timelineWeeks));
  const maxWarranty = Math.max(...bids.map((b) => b.warrantyYears));
  const maxRating = Math.max(...bids.map((b) => b.builder.avgRating));
  const best = (on: boolean) => (on && bids.length > 1 ? "bg-emerald-50 font-semibold" : "");

  return (
    <div className="container py-8">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
        <Link href={`/projects/${project.id}`}><ArrowLeft aria-hidden /> Back to project</Link>
      </Button>
      <PageHeader title="Compare bids" description={project.title} />

      {allBids.length === 0 ? (
        <EmptyState title="No bids to compare yet" description="Once builders bid you'll see them here side by side." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-4 sm:pt-5 lg:flex-row lg:items-end lg:justify-between">
              <form method="get" className="space-y-2">
                <input type="hidden" name="sort" value={sort} />
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Choose up to {BUSINESS_RULES.maxCompareBids} bids</legend>
                  <div className="flex flex-wrap gap-2">
                    {allBids.map((b) => (
                      <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
                        <input type="checkbox" name="bids" value={b.id} defaultChecked={selectedIds.has(b.id)} className="accent-[hsl(var(--primary))]" />
                        {b.builder.companyName} · {formatINRCompact(b.totalPrice)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" size="sm" variant="secondary">Update comparison</Button>
              </form>
              <nav aria-label="Sort bids" className="flex items-center gap-1 text-sm">
                <span className="mr-1 text-muted-foreground">Sort by</span>
                {(Object.keys(SORTS) as SortKey[]).map((s) => (
                  <Button key={s} asChild size="sm" variant={s === sort ? "default" : "outline"}>
                    <Link href={qs(s)} aria-current={s === sort ? "true" : undefined}>{SORTS[s]}</Link>
                  </Button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">Bids compared against our benchmark</caption>
              <thead>
                <tr className="border-b align-top">
                  <th scope="col" className="sticky left-0 z-10 w-44 bg-card p-3 text-left font-medium text-muted-foreground">
                    &nbsp;
                  </th>
                  <th scope="col" className="w-48 bg-accent/60 p-3 text-left">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">Our benchmark</span>
                    {humanize(estimate.package)} package
                  </th>
                  {bids.map((b) => (
                    <th key={b.id} scope="col" className="p-3 text-left">
                      <Link href={`/builders/${b.builder.id}`} className="font-semibold hover:underline">{b.builder.companyName}</Link>
                      <div className="mt-1 flex flex-wrap gap-1"><BidStatusBadge status={b.status} /></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_th]:sticky [&_th]:left-0 [&_th]:z-10 [&_th]:bg-card [&_th]:p-3 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:p-3 [&_tr]:border-b [&_tr]:align-top">
                <tr>
                  <th scope="row">Total price</th>
                  <td className="bg-accent/60 font-semibold">{formatINR(estimate.totalLow)} – {formatINR(estimate.totalHigh)}</td>
                  {bids.map((b) => (
                    <td key={b.id} className={best(b.totalPrice === minPrice)}>
                      <span className="text-base font-bold tabular-nums">{formatINR(b.totalPrice)}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">vs benchmark</th>
                  <td className="bg-accent/60 text-muted-foreground">—</td>
                  {bids.map((b) => (
                    <td key={b.id} className="space-y-1.5">
                      <PriceBandBadge price={b.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />
                      <UnusuallyLowWarning price={b.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Timeline</th>
                  <td className="bg-accent/60">{estimate.recommendedPlan.timelineWeeks} weeks</td>
                  {bids.map((b) => <td key={b.id} className={best(b.timelineWeeks === minWeeks)}>{b.timelineWeeks} weeks</td>)}
                </tr>
                <tr>
                  <th scope="row">Warranty</th>
                  <td className="bg-accent/60 text-muted-foreground">—</td>
                  {bids.map((b) => <td key={b.id} className={best(b.warrantyYears === maxWarranty)}>{b.warrantyYears} years</td>)}
                </tr>
                <tr>
                  <th scope="row">Builder</th>
                  <td className="bg-accent/60 text-muted-foreground">—</td>
                  {bids.map((b) => (
                    <td key={b.id} className={cn("space-y-1", best(b.builder.avgRating === maxRating))}>
                      <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />{b.builder.avgRating.toFixed(1)} ({b.builder.ratingCount})</span>
                      <p className="text-xs font-normal text-muted-foreground">{b.builder.yearsOfExperience} yrs · {b.builder.completedProjectsCount} homes</p>
                      <VerificationBadge status={b.builder.verificationStatus} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Demo</th>
                  <td className="bg-accent/60 text-muted-foreground">—</td>
                  {bids.map((b) => (
                    <td key={b.id}>
                      <p className="mb-1 text-xs text-muted-foreground">{humanize(b.demoType)}</p>
                      <DemoPreview demoType={b.demoType} demoUrls={b.demoUrls} portfolio={b.portfolio} compact />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Payment milestones</th>
                  <td className="bg-accent/60">
                    <MilestoneList items={estimate.recommendedPlan.paymentMilestones} />
                  </td>
                  {bids.map((b) => <td key={b.id}><MilestoneList items={b.milestones} /></td>)}
                </tr>
                <tr className="bg-muted/50">
                  <th scope="row" colSpan={2 + bids.length} className="!bg-muted/50 font-semibold !text-foreground">Materials</th>
                </tr>
                {MATERIAL_FIELDS.map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td className="bg-accent/60 text-muted-foreground">—</td>
                    {bids.map((b) => <td key={b.id}>{b.materials[key]}</td>)}
                  </tr>
                ))}
                <tr className="bg-muted/50">
                  <th scope="row" colSpan={2 + bids.length} className="!bg-muted/50 font-semibold !text-foreground">Cost breakdown (BOQ)</th>
                </tr>
                {BREAKDOWN_CATEGORIES.map((c) => {
                  const est = estimate.breakdown.categories.find((x) => x.category === c);
                  return (
                    <tr key={c}>
                      <th scope="row">{CATEGORY_LABELS[c]}</th>
                      <td className="bg-accent/60 tabular-nums">{est ? `${formatINRCompact(est.amountLow)}–${formatINRCompact(est.amountHigh)}` : "—"}</td>
                      {bids.map((b) => (
                        <td key={b.id} className="tabular-nums">
                          {formatINR(b.breakdown[c])}
                          <span className="ml-1 text-xs text-muted-foreground">({Math.round((b.breakdown[c] / b.totalPrice) * 1000) / 10}%)</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {estimate.breakdown.extras.length > 0 && (
                  <tr>
                    <th scope="row">Extras in benchmark</th>
                    <td className="bg-accent/60">{estimate.breakdown.extras.map((e) => e.label).join(", ")}</td>
                    {bids.map((b) => <td key={b.id} className="text-xs text-muted-foreground">Included in total</td>)}
                  </tr>
                )}
                <tr>
                  <th scope="row">Actions</th>
                  <td className="bg-accent/60" />
                  {bids.map((b) => (
                    <td key={b.id}>
                      <BidActions bidId={b.id} status={b.status} builderName={b.builder.companyName} totalPrice={b.totalPrice} canDecide={canDecide} compact />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Green cells mark the best value in each row. Bids more than {BUSINESS_RULES.unusuallyLowThreshold * 100}% below our low estimate are flagged as unusually low.
          </p>
        </div>
      )}
    </div>
  );
}

function MilestoneList({ items }: { items: { name: string; percent: number }[] }) {
  return (
    <ol className="space-y-0.5 text-xs">
      {items.map((m) => (
        <li key={m.name} className="flex justify-between gap-2">
          <span>{m.name}</span>
          <span className="tabular-nums font-medium">{m.percent}%</span>
        </li>
      ))}
    </ol>
  );
}
