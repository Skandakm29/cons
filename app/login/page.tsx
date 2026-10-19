import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth/session";
import { isGoogleEnabled } from "@/lib/auth/options";
import { isSmsEnabled } from "@/lib/auth/otp";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; method?: string; error?: string }>;
}) {
  const { callbackUrl, method, error } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div className="container flex max-w-md flex-col py-12">
      <AuthCard
        mode="login"
        googleEnabled={isGoogleEnabled()}
        smsEnabled={isSmsEnabled()}
        initialChannel={method === "phone" ? "phone" : "email"}
        callbackUrl={callbackUrl}
        errorCode={error}
      />
    </div>
  );
}
