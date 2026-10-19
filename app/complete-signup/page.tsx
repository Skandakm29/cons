import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth/session";
import { readSignupToken } from "@/lib/auth/signup-token";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleButton } from "@/components/auth/auth-card";
import { CompleteSignupForm } from "@/components/auth/complete-signup-form";

export const metadata: Metadata = { title: "Finish signing up" };

export default async function CompleteSignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const claims = token ? readSignupToken(token) : null;

  return (
    <div className="container flex max-w-md flex-col py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Almost done</CardTitle>
          <CardDescription>{claims ? <>Signed in with Google as <strong>{claims.email}</strong>.</> : "Your Google sign-in link has expired."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {claims && token ? (
            <CompleteSignupForm token={token} defaultName={claims.name} />
          ) : (
            <>
              <Alert variant="warning">Please continue with Google again to finish signing up.</Alert>
              <GoogleButton />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
