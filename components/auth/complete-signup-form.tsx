"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { completeGoogleSignupAction } from "@/lib/actions/auth";
import { googleSignupSchema, type GoogleSignupInput } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CompleteSignupForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<GoogleSignupInput>({
    resolver: zodResolver(googleSignupSchema),
    defaultValues: { token, name: defaultName, phone: "", role: "HOMEOWNER" },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        const res = await completeGoogleSignupAction(v);
        if (!res.ok) return setError(res.error);
        const login = await signIn("google-signup", { redirect: false, token });
        if (!login || login.error) return setError(login?.error ?? "Couldn't sign you in. Please try again.");
        router.push(v.role === "BUILDER" ? "/builder/onboarding" : "/post-login");
        router.refresh();
      })}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I am a…</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["HOMEOWNER", "BUILDER"] as const).map((r) => (
            <label key={r} className="flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
              <input type="radio" value={r} className="sr-only" {...form.register("role")} />
              <span className="font-semibold">{r === "HOMEOWNER" ? "Homeowner" : "Builder"}</span>
              <span className="text-xs text-muted-foreground">{r === "HOMEOWNER" ? "I want to build a house" : "I build houses"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input {...fieldAria("name", errors.name?.message)} autoComplete="name" {...form.register("name")} />
      </Field>
      <Field id="phone" label="Mobile number" hint="Shared with your builder or homeowner only after a project is awarded" error={errors.phone?.message}>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm">+91</span>
          <Input {...fieldAria("phone", errors.phone?.message)} type="tel" inputMode="numeric" autoComplete="tel-national" className="rounded-l-none" {...form.register("phone")} />
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Create account
      </Button>
    </form>
  );
}
