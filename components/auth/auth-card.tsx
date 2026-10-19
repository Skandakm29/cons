"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeAuthForm, type AuthChannel, type AuthMode } from "./code-auth-form";

const ERRORS: Record<string, string> = {
  GoogleEmailUnverified: "Your Google account's email isn't verified. Please use an email code instead.",
  OAuthSignin: "Couldn't start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  AccessDenied: "Sign-in was cancelled.",
};

export function GoogleButton({ callbackUrl, label = "Continue with Google" }: { callbackUrl?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn("google", { callbackUrl: callbackUrl?.startsWith("/") ? callbackUrl : "/post-login" });
      }}
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
      )}
      {label}
    </Button>
  );
}

export function AuthCard({
  mode,
  googleEnabled,
  smsEnabled,
  initialChannel,
  callbackUrl,
  defaultRole,
  errorCode,
}: {
  mode: AuthMode;
  googleEnabled: boolean;
  smsEnabled: boolean;
  initialChannel: AuthChannel;
  callbackUrl?: string;
  defaultRole?: "HOMEOWNER" | "BUILDER";
  errorCode?: string;
}) {
  const [channel, setChannel] = useState<AuthChannel>(initialChannel);
  const other: AuthChannel = channel === "email" ? "phone" : "email";
  const switchHref = `/${mode === "login" ? "signup" : "login"}${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{mode === "login" ? "Log in" : "Create your account"}</CardTitle>
        <CardDescription>
          {mode === "login" ? "No password needed — we'll send you a one-time code." : "Free for homeowners. Builders get verified before bidding."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {errorCode && <Alert variant="danger">{ERRORS[errorCode] ?? "Sign-in failed. Please try again."}</Alert>}
        {googleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} label={mode === "login" ? "Continue with Google" : "Sign up with Google"} />
            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground" aria-hidden>
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        {/* key resets the form when switching channel */}
        <CodeAuthForm key={channel} mode={mode} channel={channel} callbackUrl={callbackUrl} defaultRole={defaultRole} />
        {(smsEnabled || channel === "phone") && (
          <p className="text-center text-sm">
            <button type="button" className="text-primary underline" onClick={() => setChannel(other)}>
              {other === "phone" ? "Use mobile number instead" : "Use email instead"}
            </button>
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <Link className="font-medium text-primary underline" href={switchHref}>
            {mode === "login" ? "Create an account" : "Log in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
