import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { closeExpiredBidding } from "@/lib/services/projects";
import { formatDate, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BidStatusBadge, ProjectStatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "My bids" };

export default async function BuilderBidsPage() {
  const user = await requirePageUser(["BUILDER"]);
  await closeExpiredBidding();
  const profile = await prisma.builderProfile.findUnique({ where: { userId: user.id } });
  const bids = profile
    ? await prisma.bid.findMany({
        where: { builderId: profile.id },
        orderBy: { updatedAt: "desc" },
        include: {
          project: { select: { id: true, title: true, city: true, locality: true, status: true, bidDeadline: true } },
          _count: { select: { messages: true } },
        },
      })
    : [];

  return (
    <div className="container py-8">
      <PageHeader title="My bids" description="Every quote you've submitted and where it stands." />
      {bids.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No bids yet"
          description="Browse open projects and submit your first quote."
          action={<Button asChild><Link href="/builder/projects">Browse open projects</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {bids.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                  <div className="min-w-0">
                    <Link href={`/builder/projects/${b.project.id}`} className="font-semibold hover:underline">{b.project.title}</Link>
                    <p className="text-sm text-muted-foreground">
                      {b.project.locality}, {b.project.city}
                      {b.project.bidDeadline && ` · deadline ${formatDate(b.project.bidDeadline)}`}
                      {b.revisionCount > 0 && ` · revised ${b.revisionCount}×`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <BidStatusBadge status={b.status} />
                      <ProjectStatusBadge status={b.project.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <span className="text-lg font-bold tabular-nums">{formatINR(b.totalPrice)}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/bids/${b.id}`}>Chat ({b._count.messages})</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
