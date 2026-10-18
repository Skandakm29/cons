import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarClock, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { SUPPORTED_CITIES } from "@/lib/config";
import { PACKAGES } from "@/lib/estimator/types";
import { closeExpiredBidding } from "@/lib/services/projects";
import { floorsLabel, formatDate, formatINR, formatINRCompact, formatSqft, humanize } from "@/lib/format";
import { projectFiltersSchema } from "@/lib/validation/project";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BidStatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Open projects" };

export default async function BuilderProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePageUser(["BUILDER"]);
  await closeExpiredBidding();
  const f = projectFiltersSchema.parse(await searchParams);
  const profile = await prisma.builderProfile.findUnique({ where: { userId: user.id } });

  const where: Prisma.ProjectWhereInput = {
    status: "OPEN",
    bidDeadline: { gt: new Date() },
    ...(f.city && { city: f.city }),
    ...(f.package && { preferredPackage: f.package }),
    ...((f.minArea || f.maxArea) && { builtUpAreaSqft: { gte: f.minArea, lte: f.maxArea } }),
    // Budget filter: projects whose budget range overlaps the requested range.
    ...(f.minBudget && { budgetMax: { gte: f.minBudget } }),
    ...(f.maxBudget && { budgetMin: { lte: f.maxBudget } }),
  };
  const projects = await prisma.project.findMany({
    where,
    orderBy: { bidDeadline: "asc" },
    include: {
      estimates: { orderBy: { createdAt: "desc" }, take: 1, select: { totalLow: true, totalHigh: true } },
      // Sealed bidding: only this builder's own bid is loaded.
      bids: profile ? { where: { builderId: profile.id }, select: { status: true, totalPrice: true } } : false,
    },
  });

  return (
    <div className="container py-8">
      <PageHeader title="Open projects" description="Homeowners looking for builders right now. Our benchmark is shown on every project." />
      {!profile && (
        <Alert variant="info" className="mb-4">
          Complete your <Link href="/builder/onboarding" className="font-semibold underline">builder profile</Link> to get verified and start bidding.
        </Alert>
      )}
      {profile && profile.verificationStatus !== "VERIFIED" && (
        <Alert variant="warning" className="mb-4">
          Your profile is <strong>{profile.verificationStatus.toLowerCase()}</strong>. You can browse projects, but bidding unlocks after verification.
        </Alert>
      )}

      <details className="mb-6 rounded-lg border bg-card p-4 md:open:pb-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Filters</summary>
        <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="f-city">City</Label>
            <Select id="f-city" name="city" defaultValue={f.city ?? ""}>
              <option value="">All cities</option>
              {SUPPORTED_CITIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-pkg">Package</Label>
            <Select id="f-pkg" name="package" defaultValue={f.package ?? ""}>
              <option value="">Any</option>
              {PACKAGES.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-minArea">Min sqft</Label>
            <Input id="f-minArea" name="minArea" type="number" inputMode="numeric" defaultValue={f.minArea} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-maxArea">Max sqft</Label>
            <Input id="f-maxArea" name="maxArea" type="number" inputMode="numeric" defaultValue={f.maxArea} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-minBudget">Min budget ₹</Label>
            <Input id="f-minBudget" name="minBudget" type="number" inputMode="numeric" step={100000} defaultValue={f.minBudget} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-maxBudget">Max budget ₹</Label>
            <Input id="f-maxBudget" name="maxBudget" type="number" inputMode="numeric" step={100000} defaultValue={f.maxBudget} />
          </div>
          <div className="flex gap-2">
            <Button type="submit"><Search aria-hidden /> Apply</Button>
            <Button asChild variant="ghost"><Link href="/builder/projects">Reset</Link></Button>
          </div>
        </form>
      </details>

      {projects.length === 0 ? (
        <EmptyState title="No open projects match" description="Try widening your filters, or check back soon — we'll notify you when new projects are posted in your cities." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const est = p.estimates[0];
            const myBid = Array.isArray(p.bids) ? p.bids[0] : undefined;
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        <Link href={`/builder/projects/${p.id}`} className="hover:underline">{p.title}</Link>
                      </CardTitle>
                      <Badge variant="outline">{humanize(p.preferredPackage)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.locality}, {p.city} · {formatSqft(p.builtUpAreaSqft)} · {floorsLabel(p.floors)} · {p.bedrooms} BHK
                    </p>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-accent/60 p-2">
                        <p className="text-xs text-muted-foreground">Our benchmark</p>
                        <p className="font-semibold">{est ? `${formatINRCompact(est.totalLow)} – ${formatINRCompact(est.totalHigh)}` : "—"}</p>
                      </div>
                      <div className="rounded-md bg-muted p-2">
                        <p className="text-xs text-muted-foreground">Homeowner budget</p>
                        <p className="font-semibold">{formatINRCompact(p.budgetMin)} – {formatINRCompact(p.budgetMax)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <CalendarClock className="h-4 w-4" aria-hidden /> Closes {p.bidDeadline && formatDate(p.bidDeadline)}
                      </span>
                      {myBid ? (
                        <span className="flex items-center gap-2">Your bid {formatINR(myBid.totalPrice)} <BidStatusBadge status={myBid.status} /></span>
                      ) : (
                        <Button asChild size="sm"><Link href={`/builder/projects/${p.id}`}>View & bid</Link></Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
