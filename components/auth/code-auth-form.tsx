"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  requestEmailLoginOtpAction,
  requestEmailSignupOtpAction,
  requestLoginOtpAction,
  requestSignupOtpAction,
} from "@/lib/actions/auth";
import { phoneSchema } from "@/lib/validation/common";
import { emailSchema, emailSignupSchema, signupSchema } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type AuthMode = "login" | "signup";
export type AuthChannel = "email" | "phone";
type Role = "HOMEOWNER" | "BUILDER";
type Values = { name: string; email: string; phone: string; role: Role };

const role = z.enum(["HOMEOWNER", "BUILDER"]);
// Each mode/channel validates only the fields it shows; the rest pass through untouched.
const SCHEMAS: Record<AuthMode, Record<AuthChannel, z.ZodType<Values, z.ZodTypeDef, Values>>> = {
  login: {
    email: z.object({ email: emailSchema, name: z.string(), phone: z.string(), role }),
    phone: z.object({ phone: phoneSchema, name: z.string(), email: z.string(), role }),
  },
  signup: {
    email: emailSignupSchema,
    phone: signupSchema.extend({ email: z.string() }),
  },
};

const REQUEST = {
  login: { email: requestEmailLoginOtpAction, phone: requestLoginOtpAction },
  signup: { email: requestEmailSignupOtpAction, phone: requestSignupOtpAction },
} as const;

export function CodeAuthForm({
  mode,
  channel,
  callbackUrl,
  defaultRole = "HOMEOWNER",
}: {
  mode: AuthMode;
  channel: AuthChannel;
  callbackUrl?: string;
  defaultRole?: Role;
}) {
  const router = useRouter();
  const [sent, setSent] = useState<{ values: Values; to: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(SCHEMAS[mode][channel]),
    defaultValues: { name: "", email: "", phone: "", role: defaultRole },
  });
  const { errors, isSubmitting } = form.formState;

  async function sendCode(values: Values) {
    setError(null);
    const res = await REQUEST[mode][channel](values);
    if (!res.ok) return setError(res.error);
    setSent({ values, to: res.data.to });
    setHint(res.data.devHint);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sent) return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setError(null);
    setVerifying(true);
    const { values, to } = sent;
    const res = await signIn(channel === "email" ? "email-otp" : "phone-otp", {
      redirect: false,
      mode,
      code,
      ...(channel === "email" ? { email: to } : { phone: to }),
      ...(mode === "signup" ? { name: values.name, role: values.role, ...(channel === "email" ? { phone: values.phone } : {}) } : {}),
    });
    setVerifying(false);
    if (!res || res.error) return setError(res?.error && res.error !== "CredentialsSignin" ? res.error : "Incorrect or expired code");
    const fallback = mode === "signup" && values.role === "BUILDER" ? "/builder/onboarding" : "/post-login";
    router.push(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : fallback);
    router.refresh();
  }

  if (sent) {
    return (
      <form onSubmit={verify} className="space-y-4" noValidate>
        <p className="text-sm">
          We sent a 6-digit code to <strong>{channel === "email" ? sent.to : `+91 ${sent.to}`}</strong>.{" "}
          <button type="button" className="text-primary underline" onClick={() => { setSent(null); setCode(""); setError(null); }}>
            Change
          </button>
        </p>
        {channel === "email" && <p className="text-xs text-muted-foreground">Can&apos;t find it? Check your spam or promotions folder.</p>}
        {hint && <Alert variant="info">{hint}</Alert>}
        <Field id="otp" label="6-digit code" error={error ?? undefined}>
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

  const phoneField = (label: string, hint: string) => (
    <Field id="phone" label={label} hint={hint} error={errors.phone?.message}>
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
  );

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
      {channel === "email" ? (
        <>
          <Field id="email" label="Email" error={errors.email?.message}>
            <Input {...fieldAria("email", errors.email?.message)} type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
          </Field>
          {mode === "signup" && phoneField("Mobile number", "Shared with your builder or homeowner only after a project is awarded")}
        </>
      ) : (
        phoneField("Mobile number", "10-digit Indian mobile number")
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} {channel === "email" ? "Email me a code" : "Text me a code"}
      </Button>
    </form>
  );
}
