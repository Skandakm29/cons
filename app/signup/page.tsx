import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; role?: string }>;
}) {
  const { callbackUrl, role } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div className="container flex max-w-md flex-col py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Free for homeowners. Builders get verified before bidding.</CardDescription>
        </CardHeader>
        <CardContent>
          <OtpForm mode="signup" callbackUrl={callbackUrl} defaultRole={role === "BUILDER" ? "BUILDER" : "HOMEOWNER"} />
        </CardContent>
      </Card>
    </div>
  );
}
