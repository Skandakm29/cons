import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import type { VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { formatDate, maskPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { VerificationBadge } from "@/components/status-badge";
import { VerifyBuilder } from "@/components/admin/verify-builder";

export const metadata: Metadata = { title: "Builder verification" };

const TABS: VerificationStatus[] = ["PENDING", "VERIFIED", "REJECTED"];

export default async function AdminBuildersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageUser(["ADMIN"]);
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t === raw) ?? "PENDING";
  const [builders, counts] = await Promise.all([
    prisma.builderProfile.findMany({
      where: { verificationStatus: status },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, phone: true } }, portfolio: { select: { id: true, title: true, imageUrls: true } } },
    }),
    prisma.builderProfile.groupBy({ by: ["verificationStatus"], _count: true }),
  ]);
  const count = (s: VerificationStatus) => counts.find((c) => c.verificationStatus === s)?._count ?? 0;

  return (
    <div className="container py-8">
      <PageHeader title="Builder verification" description="Check documents and portfolio before allowing a builder to bid." />
      <nav aria-label="Status" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Button key={t} asChild size="sm" variant={t === status ? "default" : "outline"}>
            <Link href={`?status=${t}`} aria-current={t === status ? "page" : undefined}>{t.charAt(0) + t.slice(1).toLowerCase()} ({count(t)})</Link>
          </Button>
        ))}
      </nav>
      {builders.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={status === "PENDING" ? "Queue is empty" : `No ${status.toLowerCase()} builders`} description={status === "PENDING" ? "New builder sign-ups will appear here." : undefined} />
      ) : (
        <ul className="space-y-3">
          {builders.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="grid gap-4 pt-4 sm:pt-5 md:grid-cols-3">
                  <div className="space-y-1 text-sm md:col-span-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/builders/${b.id}`} className="text-base font-semibold hover:underline">{b.companyName}</Link>
                      <VerificationBadge status={b.verificationStatus} />
                    </div>
                    <p className="text-muted-foreground">{b.user.name} · {maskPhone(b.user.phone)} · joined {formatDate(b.createdAt)}</p>
                    <p>{b.yearsOfExperience} yrs experience · {b.completedProjectsCount} homes · serves {b.citiesServed.join(", ")}</p>
                    <p>GSTIN: <span className="font-mono">{b.gstNumber ?? "not provided"}</span></p>
                    <p>
                      Licence:{" "}
                      {b.licenseDocUrl ? (
                        <a href={b.licenseDocUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline"><FileText className="h-4 w-4" aria-hidden />View document</a>
                      ) : (
                        <span className="text-amber-700">not uploaded</span>
                      )}
                    </p>
                    {b.verificationNote && <p className="text-red-700">Last rejection: {b.verificationNote}</p>}
                    {b.about && <p className="line-clamp-2 text-muted-foreground">{b.about}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {b.portfolio.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p.id} src={p.imageUrls[0]} alt={p.title} title={p.title} className="h-14 w-20 rounded border object-cover" />
                      ))}
                      {b.portfolio.length === 0 && <span className="text-muted-foreground">No portfolio items</span>}
                    </div>
                  </div>
                  <div className="md:justify-self-end">
                    {b.verificationStatus !== "VERIFIED" && <VerifyBuilder builderId={b.id} />}
                    {b.verificationStatus === "VERIFIED" && b.verifiedAt && <p className="text-sm text-muted-foreground">Verified {formatDate(b.verifiedAt)}</p>}
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
