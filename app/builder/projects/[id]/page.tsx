import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import type { BreakdownPercents } from "@/lib/estimator/types";
import { distributeByPercents } from "@/lib/estimator";
import { getLatestEstimate } from "@/lib/services/estimates";
import { closeExpiredBidding, isBiddingOpen } from "@/lib/services/projects";
import { EXTRA_LABELS, type ExtraKey } from "@/lib/estimator/types";
import { floorsLabel, formatDate, formatDateTime, formatINR, formatSqft, humanize } from "@/lib/format";
import type { BidFormValues } from "@/lib/validation/bid";
import { parseBidBreakdown, parseMaterialsSpec, parseMilestones } from "@/lib/validation/json";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateCard } from "@/components/estimate-card";
import { PageHeader } from "@/components/page-header";
import { BidStatusBadge, ProjectStatusBadge } from "@/components/status-badge";
import { BidForm } from "@/components/bids/bid-form";
import { WithdrawBidButton } from "@/components/bids/withdraw-button";

export const metadata: Metadata = { title: "Project details" };

const EMPTY_MATERIALS = { cement: "", steel: "", blocks: "", tiles: "", paint: "", electrical: "", plumbing: "", sanitary: "", doors: "" };

export default async function BuilderProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(["BUILDER"]);
  await closeExpiredBidding();
  const [project, profile] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: { homeowner: { select: { name: true } } } }),
    prisma.builderProfile.findUnique({ where: { userId: user.id }, include: { portfolio: true } }),
  ]);
  if (!project) notFound();

  // Sealed bidding: load only this builder's own bid.
  const myBid = profile
    ? await prisma.bid.findUnique({
        where: { projectId_builderId: { projectId: project.id, builderId: profile.id } },
        include: { revisions: { orderBy: { revisionNumber: "desc" } } },
      })
    : null;
  // Builders can see OPEN projects, plus any project they've bid on.
  if (project.status !== "OPEN" && !myBid) notFound();

  const estimate = await getLatestEstimate(project.id);
  if (!estimate) notFound();
  const percents = Object.fromEntries(estimate.breakdown.categories.map((c) => [c.category, c.percent])) as BreakdownPercents;
  const open = isBiddingOpen(project);
  const verified = profile?.verificationStatus === "VERIFIED";
  const servesCity = !!profile?.citiesServed.includes(project.city);
  const editable = open && verified && servesCity && (!myBid || ["SUBMITTED", "SHORTLISTED", "WITHDRAWN"].includes(myBid.status));

  const suggested = Math.round((estimate.totalLow + estimate.totalHigh) / 2 / 10_000) * 10_000;
  const initial: BidFormValues = myBid
    ? {
        projectId: project.id,
        totalPrice: myBid.totalPrice,
        breakdown: parseBidBreakdown(myBid.breakdown),
        timelineWeeks: myBid.timelineWeeks,
        materialsSpec: parseMaterialsSpec(myBid.materialsSpec),
        warrantyYears: myBid.warrantyYears,
        paymentMilestones: parseMilestones(myBid.paymentMilestones),
        demoType: myBid.demoType,
        demoUrls: myBid.demoUrls,
        demoPortfolioItemIds: myBid.demoPortfolioItemIds,
        coverNote: myBid.coverNote,
      }
    : {
        projectId: project.id,
        totalPrice: suggested,
        breakdown: distributeByPercents(suggested, percents),
        timelineWeeks: estimate.recommendedPlan.timelineWeeks,
        materialsSpec: EMPTY_MATERIALS,
        warrantyYears: 10,
        paymentMilestones: estimate.recommendedPlan.paymentMilestones,
        demoType: profile && profile.portfolio.length > 0 ? "PORTFOLIO" : "IMAGES",
        demoUrls: [],
        demoPortfolioItemIds: [],
        coverNote: "",
      };

  const extras = (Object.entries({
    basement: project.extraBasement, lift: project.extraLift, compoundWall: project.extraCompoundWall,
    sump: project.extraSump, solar: project.extraSolar,
  }) as [ExtraKey, boolean][]).filter(([, on]) => on).map(([k]) => EXTRA_LABELS[k]);

  return (
    <div className="container space-y-6 py-8">
      <PageHeader
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span>{project.locality}, {project.city} · posted by {project.homeowner.name.split(" ")[0]}</span>
            {project.bidDeadline && (
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" aria-hidden /> {open ? "Closes" : "Closed"} {formatDate(project.bidDeadline)}</span>
            )}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Requirements</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <D l="Plot" v={`${project.plotLengthFt} × ${project.plotWidthFt} ft (${formatSqft(project.plotAreaSqft)}) · ${humanize(project.facing)} facing`} />
                <D l="Built-up" v={`${formatSqft(project.builtUpAreaSqft)} · ${floorsLabel(project.floors)}`} />
                <D l="Rooms" v={`${project.bedrooms} bed · ${project.bathrooms} bath`} />
                <D l="Parking / Vastu" v={`${project.parking ? "Yes" : "No"} / ${project.vastuRequired ? "Yes" : "No"}`} />
                <D l="Preferred package" v={humanize(project.preferredPackage)} />
                <D l="Extras" v={extras.join(", ") || "None"} />
                <D l="Budget" v={`${formatINR(project.budgetMin)} – ${formatINR(project.budgetMax)}`} />
                <D l="Start" v={project.startTimeline} />
              </dl>
              {project.notes && <p className="mt-4 rounded-md bg-muted p-3 text-sm">“{project.notes}”</p>}
            </CardContent>
          </Card>
          <EstimateCard estimate={estimate} />

          {!profile ? (
            <Alert variant="info">Complete your <Link className="font-semibold underline" href="/builder/onboarding">builder profile</Link> to bid.</Alert>
          ) : !verified ? (
            <Alert variant="warning">Bidding unlocks once your profile is verified by our team.</Alert>
          ) : !servesCity ? (
            <Alert variant="warning">Add {project.city} to the cities you serve in your <Link className="underline" href="/builder/onboarding">profile</Link> to bid.</Alert>
          ) : !open && !myBid ? (
            <Alert>Bidding has closed for this project.</Alert>
          ) : null}

          {editable && (
            <section aria-labelledby="bid-heading">
              <h2 id="bid-heading" className="mb-3 text-xl font-bold">{myBid && myBid.status !== "WITHDRAWN" ? "Edit your bid" : "Submit your bid"}</h2>
              <BidForm
                initial={initial}
                percents={percents}
                benchmark={{ low: estimate.totalLow, high: estimate.totalHigh }}
                portfolio={profile?.portfolio.map((p) => ({ id: p.id, title: p.title, imageUrls: p.imageUrls })) ?? []}
                isRevision={!!myBid}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {myBid && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Your bid</CardTitle>
                  <BidStatusBadge status={myBid.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-2xl font-bold">{formatINR(myBid.totalPrice)}</p>
                <p className="text-muted-foreground">{myBid.timelineWeeks} weeks · {myBid.warrantyYears}-yr warranty · updated {formatDateTime(myBid.updatedAt)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/bids/${myBid.id}`}><MessageSquare aria-hidden /> Chat with homeowner</Link></Button>
                  {open && (myBid.status === "SUBMITTED" || myBid.status === "SHORTLISTED") && <WithdrawBidButton bidId={myBid.id} />}
                </div>
                {myBid.revisions.length > 0 && (
                  <div>
                    <h3 className="mb-1 font-semibold">Revision history</h3>
                    <ol className="space-y-1 text-muted-foreground">
                      {myBid.revisions.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2">
                          <span>v{r.revisionNumber} · {formatDateTime(r.createdAt)}</span>
                          <span className="tabular-nums">{formatINR(r.totalPrice)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground sm:pt-5">
              <strong className="text-foreground">Sealed bidding.</strong> Other builders can&apos;t see your price, and you can&apos;t see theirs.
              Contact details are shared only once the homeowner awards the project.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function D({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{l}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
