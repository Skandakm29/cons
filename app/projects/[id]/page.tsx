import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BidStatus } from "@prisma/client";
import { CalendarClock, Columns3, Phone, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { getLatestEstimate } from "@/lib/services/estimates";
import { closeExpiredBidding, getOwnedProject } from "@/lib/services/projects";
import { EXTRA_LABELS, type ExtraKey } from "@/lib/estimator/types";
import { floorsLabel, formatDate, formatINR, formatSqft, humanize } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { EstimateCard } from "@/components/estimate-card";
import { PageHeader } from "@/components/page-header";
import { PriceBandBadge, UnusuallyLowWarning } from "@/components/price-band-badge";
import { BidStatusBadge, ProjectStatusBadge, VerificationBadge } from "@/components/status-badge";
import { BidActions } from "@/components/projects/bid-actions";
import { ProjectOwnerActions } from "@/components/projects/project-owner-actions";
import { ReviewForm } from "@/components/projects/review-form";

export const metadata: Metadata = { title: "Project" };

const STATUS_ORDER: Record<BidStatus, number> = { AWARDED: 0, SHORTLISTED: 1, SUBMITTED: 2, REJECTED: 3, WITHDRAWN: 4 };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const user = await requirePageUser(["HOMEOWNER"]);
  await closeExpiredBidding();
  const project = await getOwnedProject(id, user);
  if (!project) notFound();

  const [estimate, unsortedBids, review] = await Promise.all([
    getLatestEstimate(project.id),
    prisma.bid.findMany({
      where: { projectId: project.id, status: { not: "WITHDRAWN" } },
      include: { builder: { include: { user: { select: { phone: true, name: true } } } } },
      orderBy: { totalPrice: "asc" },
    }),
    prisma.review.findUnique({ where: { projectId: project.id } }),
  ]);
  const bids = [...unsortedBids].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const awardedBid = bids.find((b) => b.id === project.awardedBidId);
  const canDecide = project.status === "OPEN" || project.status === "UNDER_REVIEW";
  const extras = (Object.entries({
    basement: project.extraBasement, lift: project.extraLift, compoundWall: project.extraCompoundWall,
    sump: project.extraSump, solar: project.extraSolar,
  }) as [ExtraKey, boolean][]).filter(([, on]) => on).map(([k]) => EXTRA_LABELS[k]);

  return (
    <div className="container space-y-6 py-8">
      {created && (
        <Alert variant="success">
          <strong>{project.status === "DRAFT" ? "Draft saved." : "Your project is live!"}</strong> Here&apos;s our price benchmark.{" "}
          {project.status === "OPEN" && "Verified builders will start bidding — we'll notify you as quotes arrive."}
        </Alert>
      )}
      <PageHeader
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span>{project.locality}, {project.city}</span>
            {project.status === "OPEN" && project.bidDeadline && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-4 w-4" aria-hidden /> Bidding closes {formatDate(project.bidDeadline)}
              </span>
            )}
          </span>
        }
        actions={<ProjectOwnerActions projectId={project.id} status={project.status} />}
      />
      {project.moderationNote && <Alert variant="warning">Moderator note: {project.moderationNote}</Alert>}

      {awardedBid && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader>
            <CardTitle>Awarded to {awardedBid.builder.companyName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p>Contract value: <strong>{formatINR(awardedBid.totalPrice)}</strong> · {awardedBid.timelineWeeks} weeks</p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" aria-hidden /> {awardedBid.builder.user.name}: <a className="font-semibold underline" href={`tel:+91${awardedBid.builder.user.phone}`}>+91 {awardedBid.builder.user.phone}</a>
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={`/bids/${awardedBid.id}`}>Open bid & chat</Link>
              </Button>
            </div>
            <div>
              {review ? (
                <p className="text-sm">
                  You rated this builder <strong>{review.rating}<Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="stars" /></strong>
                  {review.comment && <> — “{review.comment}”</>}
                </p>
              ) : (
                <ReviewForm projectId={project.id} builderName={awardedBid.builder.companyName} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {estimate ? <EstimateCard estimate={estimate} /> : <Alert variant="warning">No estimate available for this project yet.</Alert>}

          <section aria-labelledby="bids-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="bids-heading" className="text-xl font-bold">Bids ({bids.length})</h2>
              {bids.length > 1 && (
                <Button asChild variant="outline">
                  <Link href={`/projects/${project.id}/compare`}>
                    <Columns3 aria-hidden /> Compare side by side
                  </Link>
                </Button>
              )}
            </div>
            {bids.length === 0 ? (
              <EmptyState
                title={project.status === "DRAFT" ? "Publish to start receiving bids" : "No bids yet"}
                description={project.status === "DRAFT" ? "Builders can't see drafts." : "Verified builders typically respond within 2–3 days."}
              />
            ) : (
              <ul className="space-y-3">
                {bids.map((b) => (
                  <li key={b.id}>
                    <Card>
                      <CardContent className="space-y-3 pt-4 sm:pt-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <Link href={`/builders/${b.builder.id}`} className="font-semibold hover:underline">{b.builder.companyName}</Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <VerificationBadge status={b.builder.verificationStatus} />
                              <span className="inline-flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />{b.builder.avgRating.toFixed(1)}</span>
                              <span>{b.builder.yearsOfExperience} yrs · {b.builder.completedProjectsCount} homes</span>
                            </div>
                          </div>
                          <BidStatusBadge status={b.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-2xl font-bold tabular-nums">{formatINR(b.totalPrice)}</span>
                          {estimate && <PriceBandBadge price={b.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />}
                        </div>
                        {estimate && <UnusuallyLowWarning price={b.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />}
                        <p className="text-sm text-muted-foreground">
                          {b.timelineWeeks} weeks · {b.warrantyYears}-year warranty · demo: {humanize(b.demoType)}
                          {b.revisionCount > 0 && ` · revised ${b.revisionCount}×`}
                        </p>
                        <p className="line-clamp-2 text-sm">{b.coverNote}</p>
                        <BidActions bidId={b.id} status={b.status} builderName={b.builder.companyName} totalPrice={b.totalPrice} canDecide={canDecide} />
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <Card>
            <CardHeader><CardTitle className="text-base">Project details</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Detail label="Plot" value={`${project.plotLengthFt} × ${project.plotWidthFt} ft · ${formatSqft(project.plotAreaSqft)}`} />
                <Detail label="Facing" value={humanize(project.facing)} />
                <Detail label="Built-up" value={`${formatSqft(project.builtUpAreaSqft)} · ${floorsLabel(project.floors)}`} />
                <Detail label="Rooms" value={`${project.bedrooms} bed · ${project.bathrooms} bath`} />
                <Detail label="Parking / Vastu" value={`${project.parking ? "Yes" : "No"} / ${project.vastuRequired ? "Yes" : "No"}`} />
                <Detail label="Package" value={humanize(project.preferredPackage)} />
                <Detail label="Extras" value={extras.join(", ") || "None"} />
                <Detail label="Budget" value={`${formatINR(project.budgetMin)} – ${formatINR(project.budgetMax)}`} />
                <Detail label="Start" value={project.startTimeline} />
                {project.notes && <Detail label="Notes" value={project.notes} />}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
