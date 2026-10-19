import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth/session";
import { isGoogleEnabled } from "@/lib/auth/options";
import { isSmsEnabled } from "@/lib/auth/otp";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; role?: string; method?: string }>;
}) {
  const { callbackUrl, role, method } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div className="container flex max-w-md flex-col py-12">
      <AuthCard
        mode="signup"
        googleEnabled={isGoogleEnabled()}
        smsEnabled={isSmsEnabled()}
        initialChannel={method === "phone" ? "phone" : "email"}
        callbackUrl={callbackUrl}
        defaultRole={role === "BUILDER" ? "BUILDER" : "HOMEOWNER"}
      />
    </div>
  );
}
