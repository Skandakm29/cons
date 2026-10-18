import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { APP_NAME } from "@/lib/config";
import { formatDate, formatSqft } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { VerificationBadge } from "@/components/status-badge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const b = await prisma.builderProfile.findUnique({ where: { id }, select: { companyName: true } });
  return { title: b?.companyName ?? "Builder" };
}

export default async function BuilderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const builder = await prisma.builderProfile.findUnique({
    where: { id },
    include: {
      portfolio: { orderBy: { completedYear: "desc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { homeowner: { select: { name: true } } } },
    },
  });
  // Rejected profiles are not public.
  if (!builder || builder.verificationStatus === "REJECTED") notFound();

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{builder.companyName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <VerificationBadge status={builder.verificationStatus} />
            <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden /><strong className="text-foreground">{builder.avgRating.toFixed(1)}</strong> ({builder.ratingCount} reviews)</span>
            <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" aria-hidden />{builder.yearsOfExperience} yrs · {builder.completedProjectsCount} homes delivered</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{builder.citiesServed.join(", ")}</span>
          </div>
        </div>
      </div>
      {builder.about && <p className="max-w-3xl text-muted-foreground">{builder.about}</p>}

      <section aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading" className="mb-3 text-xl font-bold">Portfolio</h2>
        {builder.portfolio.length === 0 ? (
          <EmptyState title="No portfolio projects yet" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builder.portfolio.map((p) => (
              <li key={p.id}>
                <Card className="h-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrls[0]} alt={p.title} className="aspect-[3/2] w-full object-cover" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{p.city} · {formatSqft(p.areaSqft)} · {p.completedYear}</p>
                  </CardHeader>
                  {p.description && <CardContent className="text-sm">{p.description}</CardContent>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="mb-3 text-xl font-bold">Reviews from {APP_NAME} homeowners</h2>
        {builder.reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Reviews appear after a homeowner awards and rates this builder." />
        ) : (
          <ul className="space-y-3">
            {builder.reviews.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-4">
                <p className="flex items-center gap-1 font-semibold">
                  {Array.from({ length: r.rating }, (_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />)}
                  <span className="sr-only">{r.rating} out of 5</span>
                </p>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{r.homeowner.name.split(" ")[0]} · {formatDate(r.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
