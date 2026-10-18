import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { isSupportedCity, SUPPORTED_CITIES } from "@/lib/config";
import { PACKAGES } from "@/lib/estimator/types";
import { parseRate } from "@/lib/validation/json";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RateEditor } from "@/components/admin/rate-editor";

export const metadata: Metadata = { title: "Estimator rates" };

export default async function AdminRatesPage() {
  await requirePageUser(["ADMIN"]);
  const rows = await prisma.estimatorRate.findMany();
  const sorted = rows
    .filter((r) => isSupportedCity(r.city))
    .sort((a, b) => PACKAGES.indexOf(a.package) - PACKAGES.indexOf(b.package));

  return (
    <div className="container max-w-5xl py-8">
      <PageHeader title="Estimator rates" description="₹/sqft ranges and BOQ split per city and package. Changes apply to new estimates." />
      <Alert variant="warning" className="mb-6">Seeded values are placeholders — replace them with real market rates before launch.</Alert>
      {sorted.length === 0 ? (
        <EmptyState title="No rates configured" description="Run the seed script to add placeholder rates." />
      ) : (
        SUPPORTED_CITIES.map((city) => (
          <section key={city} className="mb-8" aria-labelledby={`city-${city}`}>
            <h2 id={`city-${city}`} className="mb-3 text-xl font-bold">{city}</h2>
            <div className="grid gap-3">
              {sorted.filter((r) => r.city === city).map((r) => {
                const rate = parseRate(r);
                return (
                  <RateEditor
                    key={r.id}
                    updatedAt={r.updatedAt.toISOString()}
                    initial={{ city, package: r.package, ratePerSqftLow: rate.ratePerSqftLow, ratePerSqftHigh: rate.ratePerSqftHigh, breakdownPercents: rate.breakdownPercents }}
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
