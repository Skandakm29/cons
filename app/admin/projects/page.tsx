import type { Metadata } from "next";
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { closeExpiredBidding } from "@/lib/services/projects";
import { floorsLabel, formatDate, formatINR, formatSqft, humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BidStatusBadge, ProjectStatusBadge } from "@/components/status-badge";
import { ModerateControl } from "@/components/admin/moderate";

export const metadata: Metadata = { title: "Moderation" };

const STATUSES: ProjectStatus[] = ["OPEN", "UNDER_REVIEW", "AWARDED", "DRAFT", "CANCELLED", "CLOSED"];

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageUser(["ADMIN"]);
  await closeExpiredBidding();
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s === raw);
  const projects = await prisma.project.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      homeowner: { select: { name: true } },
      bids: { orderBy: { totalPrice: "asc" }, include: { builder: { select: { companyName: true } } } },
    },
  });

  return (
    <div className="container py-8">
      <PageHeader title="Projects & bids" description="Moderate listings and remove abusive or invalid bids." />
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!status ? "default" : "outline"}><Link href="/admin/projects">All</Link></Button>
        {STATUSES.map((s) => (
          <Button key={s} asChild size="sm" variant={s === status ? "default" : "outline"}>
            <Link href={`?status=${s}`}>{humanize(s)}</Link>
          </Button>
        ))}
      </nav>
      {projects.length === 0 ? (
        <EmptyState title="No projects" />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="space-y-3 pt-4 sm:pt-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.homeowner.name} · {p.locality}, {p.city} · {formatSqft(p.builtUpAreaSqft)} {floorsLabel(p.floors)} · created {formatDate(p.createdAt)}
                      </p>
                      <div className="mt-1"><ProjectStatusBadge status={p.status} /></div>
                      {p.moderationNote && <p className="mt-1 text-xs text-amber-700">Note: {p.moderationNote}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(p.status === "OPEN" || p.status === "UNDER_REVIEW" || p.status === "DRAFT") && (
                        <ModerateControl target={{ kind: "project", id: p.id, action: "CANCEL" }} label="Cancel project" variant="destructive" />
                      )}
                      {(p.status === "CANCELLED" || p.status === "UNDER_REVIEW") && (
                        <ModerateControl target={{ kind: "project", id: p.id, action: "REOPEN" }} label="Reopen bidding" />
                      )}
                    </div>
                  </div>
                  {p.bids.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">{p.bids.length} bid{p.bids.length > 1 ? "s" : ""}</summary>
                      <ul className="mt-2 divide-y rounded-md border text-sm">
                        {p.bids.map((b) => (
                          <li key={b.id} className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="flex flex-wrap items-center gap-2">
                              <Link href={`/bids/${b.id}`} className="font-medium hover:underline">{b.builder.companyName}</Link>
                              <span className="tabular-nums">{formatINR(b.totalPrice)}</span>
                              <BidStatusBadge status={b.status} />
                            </span>
                            {b.status !== "AWARDED" && b.status !== "REJECTED" && (
                              <ModerateControl target={{ kind: "bid", id: b.id }} label="Remove bid" variant="destructive" />
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
