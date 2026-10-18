"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { requestLoginOtpAction, requestSignupOtpAction } from "@/lib/actions/auth";
import { signupSchema } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Mode = "login" | "signup";
type DetailsValues = { name: string; phone: string; role: "HOMEOWNER" | "BUILDER" };

// Login only needs the phone; signup also validates name and role.
const loginDetails = signupSchema.extend({ name: z.string() });
const SCHEMAS: Record<Mode, z.ZodType<DetailsValues, z.ZodTypeDef, DetailsValues>> = {
  login: loginDetails,
  signup: signupSchema,
};

export function OtpForm({
  mode,
  callbackUrl,
  defaultRole = "HOMEOWNER",
}: {
  mode: Mode;
  callbackUrl?: string;
  defaultRole?: "HOMEOWNER" | "BUILDER";
}) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "code">("details");
  const [details, setDetails] = useState<DetailsValues | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<DetailsValues>({
    resolver: zodResolver(SCHEMAS[mode]),
    defaultValues: { name: "", phone: "", role: defaultRole },
  });
  const { errors, isSubmitting } = form.formState;

  async function sendCode(values: DetailsValues) {
    setError(null);
    const res = mode === "signup" ? await requestSignupOtpAction(values) : await requestLoginOtpAction(values);
    if (!res.ok) return setError(res.error);
    setDetails({ ...values, phone: res.data.phone });
    setHint(res.data.devHint);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!details) return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setError(null);
    setVerifying(true);
    const res = await signIn("phone-otp", {
      redirect: false,
      mode,
      phone: details.phone,
      code,
      ...(mode === "signup" ? { name: details.name, role: details.role } : {}),
    });
    setVerifying(false);
    if (!res || res.error) return setError(res?.error && res.error !== "CredentialsSignin" ? res.error : "Incorrect or expired OTP");
    const fallback = details.role === "BUILDER" && mode === "signup" ? "/builder/onboarding" : "/post-login";
    router.push(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : fallback);
    router.refresh();
  }

  if (step === "code" && details) {
    return (
      <form onSubmit={verify} className="space-y-4" noValidate>
        <p className="text-sm">
          We sent a 6-digit code to <strong>+91 {details.phone}</strong>.{" "}
          <button type="button" className="text-primary underline" onClick={() => setStep("details")}>
            Change
          </button>
        </p>
        {hint && <Alert variant="info">{hint}</Alert>}
        <Field id="otp" label="One-time password" error={error ?? undefined}>
          <Input
            {...fieldAria("otp", error ?? undefined)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-lg tracking-[0.5em]"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying && <Loader2 className="animate-spin" aria-hidden />} Verify & continue
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(sendCode)} className="space-y-4" noValidate>
      {error && <Alert variant="danger">{error}</Alert>}
      {mode === "signup" && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">I am a…</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["HOMEOWNER", "BUILDER"] as const).map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
                >
                  <input type="radio" value={r} className="sr-only" {...form.register("role")} />
                  <span className="font-semibold">{r === "HOMEOWNER" ? "Homeowner" : "Builder"}</span>
                  <span className="text-xs text-muted-foreground">{r === "HOMEOWNER" ? "I want to build a house" : "I build houses"}</span>
                </label>
              ))}
            </div>
            {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role.message}</p>}
          </fieldset>
          <Field id="name" label="Full name" error={errors.name?.message}>
            <Input {...fieldAria("name", errors.name?.message)} autoComplete="name" {...form.register("name")} />
          </Field>
        </>
      )}
      <Field id="phone" label="Mobile number" hint="10-digit Indian mobile number" error={errors.phone?.message}>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm">+91</span>
          <Input
            {...fieldAria("phone", errors.phone?.message)}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className="rounded-l-none"
            {...form.register("phone")}
          />
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Send OTP
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link
          className="font-medium text-primary underline"
          href={`/${mode === "login" ? "signup" : "login"}${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
