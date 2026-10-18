import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Home, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { closeExpiredBidding } from "@/lib/services/projects";
import { floorsLabel, formatDate, formatINRCompact, formatSqft, humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectStatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "My projects" };

export default async function DashboardPage() {
  const user = await requirePageUser(["HOMEOWNER"]);
  await closeExpiredBidding();
  const projects = await prisma.project.findMany({
    where: { homeownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { bids: { where: { status: { not: "WITHDRAWN" } } } } },
      estimates: { orderBy: { createdAt: "desc" }, take: 1, select: { totalLow: true, totalHigh: true } },
    },
  });

  return (
    <div className="container py-8">
      <PageHeader
        title={`Hi ${user.name.split(" ")[0]} 👋`}
        description="Your construction projects and the bids they've received."
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus aria-hidden /> Post a project
            </Link>
          </Button>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No projects yet"
          description="Post your first project to get a price benchmark and quotes from verified builders."
          action={
            <Button asChild>
              <Link href="/projects/new">Post a project</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const est = p.estimates[0];
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.locality}, {p.city} · {formatSqft(p.builtUpAreaSqft)} · {floorsLabel(p.floors)} · {humanize(p.preferredPackage)}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                      <span>
                        <strong className="text-lg">{p._count.bids}</strong> bid{p._count.bids === 1 ? "" : "s"}
                      </span>
                      {est && (
                        <span className="text-muted-foreground">
                          Benchmark {formatINRCompact(est.totalLow)}–{formatINRCompact(est.totalHigh)}
                        </span>
                      )}
                      {p.status === "OPEN" && p.bidDeadline && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CalendarClock className="h-4 w-4" aria-hidden /> Closes {formatDate(p.bidDeadline)}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
