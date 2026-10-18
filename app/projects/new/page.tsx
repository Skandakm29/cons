import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { isSupportedCity } from "@/lib/config";
import { EXTRA_KEYS, PACKAGES, type EstimatorExtras } from "@/lib/estimator/types";
import { PageHeader } from "@/components/page-header";
import { ProjectWizard, type WizardPrefill } from "@/components/projects/project-wizard";

export const metadata: Metadata = { title: "Post a project" };

/** Accepts ?city=&builtUpAreaSqft=&floors=&package=&extras=a,b from the /estimate CTA. */
function parsePrefill(sp: Record<string, string | undefined>): WizardPrefill {
  const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const extras = new Set((sp.extras ?? "").split(","));
  return {
    city: sp.city && isSupportedCity(sp.city) ? sp.city : undefined,
    builtUpAreaSqft: num(sp.builtUpAreaSqft),
    floors: num(sp.floors),
    preferredPackage: PACKAGES.find((p) => p === sp.package),
    extras: EXTRA_KEYS.reduce((acc, k) => ({ ...acc, [k]: extras.has(k) }), {} as EstimatorExtras),
  };
}

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePageUser(["HOMEOWNER"]);
  const prefill = parsePrefill(await searchParams);
  return (
    <div className="container max-w-3xl py-8">
      <PageHeader title="Post your project" description="Four quick steps. We'll show our price benchmark as soon as you submit." />
      <ProjectWizard prefill={prefill} />
    </div>
  );
}
