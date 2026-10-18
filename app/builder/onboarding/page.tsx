import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { isSupportedCity } from "@/lib/config";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { VerificationBadge } from "@/components/status-badge";
import { BuilderProfileForm } from "@/components/builder/profile-form";
import { PortfolioManager } from "@/components/builder/portfolio-manager";

export const metadata: Metadata = { title: "Builder profile" };

export default async function OnboardingPage() {
  const user = await requirePageUser(["BUILDER"]);
  const profile = await prisma.builderProfile.findUnique({
    where: { userId: user.id },
    include: { portfolio: { orderBy: { completedYear: "desc" } } },
  });

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <PageHeader
        title="Your builder profile"
        description={profile ? <VerificationBadge status={profile.verificationStatus} /> : "Complete your profile to get verified and start bidding."}
        actions={profile && <Link className="text-sm text-primary underline" href={`/builders/${profile.id}`}>View public profile</Link>}
      />
      {!profile && <Alert variant="info"><strong>Step 1 of 2:</strong> Tell us about your company and upload your registration document. Then add portfolio projects.</Alert>}
      {profile?.verificationStatus === "PENDING" && (
        <Alert variant="warning"><strong>Verification pending.</strong> Our team reviews documents within 2 working days. You can browse projects, but bidding unlocks once you&apos;re verified.</Alert>
      )}
      {profile?.verificationStatus === "REJECTED" && (
        <Alert variant="danger"><strong>Verification was not approved:</strong> {profile.verificationNote}. Update your details and save to resubmit.</Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
          <CardDescription>Shown to homeowners on your bids and public profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <BuilderProfileForm
            initial={
              profile && {
                companyName: profile.companyName,
                yearsOfExperience: profile.yearsOfExperience,
                citiesServed: profile.citiesServed.filter(isSupportedCity),
                gstNumber: profile.gstNumber ?? "",
                licenseDocUrl: profile.licenseDocUrl ?? "",
                about: profile.about ?? "",
              }
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
          <CardDescription>Completed homes with photos. You can attach these as the demo on any bid.</CardDescription>
        </CardHeader>
        <CardContent>
          <PortfolioManager enabled={!!profile} items={profile?.portfolio ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
