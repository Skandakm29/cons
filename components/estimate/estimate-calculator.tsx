"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { calculateEstimateAction } from "@/lib/actions/estimate";
import { SUPPORTED_CITIES } from "@/lib/config";
import { EXTRA_KEYS, PACKAGES, type EstimateResult } from "@/lib/estimator/types";
import { floorsLabel, humanize } from "@/lib/format";
import { estimateInputSchema, type EstimateFormInput } from "@/lib/validation/estimate";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EstimateCard } from "@/components/estimate-card";
import { ExtrasFields } from "./extras-fields";

export function EstimateCalculator() {
  const [result, setResult] = useState<{ input: EstimateFormInput; estimate: EstimateResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EstimateFormInput>({
    resolver: zodResolver(estimateInputSchema),
    defaultValues: {
      city: "Bengaluru",
      builtUpAreaSqft: 2400,
      floors: 2,
      package: "STANDARD",
      extras: { basement: false, lift: false, compoundWall: false, sump: false, solar: false },
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EstimateFormInput) {
    setError(null);
    const res = await calculateEstimateAction(values);
    if (!res.ok) return setError(res.error);
    setResult({ input: values, estimate: res.data });
    requestAnimationFrame(() => document.getElementById("estimate-result")?.scrollIntoView({ behavior: "smooth" }));
  }

  const prefillHref = (v: EstimateFormInput) => {
    const q = new URLSearchParams({
      city: v.city,
      builtUpAreaSqft: String(v.builtUpAreaSqft),
      floors: String(v.floors),
      package: v.package,
      extras: EXTRA_KEYS.filter((k) => v.extras[k]).join(","),
    });
    return `/projects/new?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 sm:pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field id="city" label="City" error={errors.city?.message}>
              <Select {...fieldAria("city", errors.city?.message)} {...form.register("city")}>
                {SUPPORTED_CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field id="package" label="Package" error={errors.package?.message}>
              <Select {...fieldAria("package", errors.package?.message)} {...form.register("package")}>
                {PACKAGES.map((p) => (
                  <option key={p} value={p}>
                    {humanize(p)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="area" label="Total built-up area (sqft)" hint="All floors combined" error={errors.builtUpAreaSqft?.message}>
              <Input
                {...fieldAria("area", errors.builtUpAreaSqft?.message)}
                type="number"
                inputMode="numeric"
                {...form.register("builtUpAreaSqft", { valueAsNumber: true })}
              />
            </Field>
            <Field id="floors" label="Floors" error={errors.floors?.message}>
              <Select {...fieldAria("floors", errors.floors?.message)} {...form.register("floors", { valueAsNumber: true })}>
                {[1, 2, 3, 4, 5].map((f) => (
                  <option key={f} value={f}>
                    {floorsLabel(f)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <ExtrasFields register={form.register} error={errors.extras?.lift?.message} />
            </div>
            {error && (
              <Alert variant="danger" className="sm:col-span-2">
                {error}
              </Alert>
            )}
            <Button type="submit" size="lg" className="sm:col-span-2" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Calculate cost
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div id="estimate-result" className="scroll-mt-20 space-y-4" aria-live="polite">
          <EstimateCard estimate={{ ...result.estimate, breakdown: result.estimate }} title="Estimated construction cost" />
          <Card className="border-primary bg-accent">
            <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
              <div>
                <p className="font-semibold">This is our benchmark. Now see what real builders will charge.</p>
                <p className="text-sm text-muted-foreground">Post your project in 3 minutes — your details are pre-filled.</p>
              </div>
              <Button asChild size="lg" className="h-auto w-full whitespace-normal py-3 text-center sm:w-auto">
                <Link href={prefillHref(result.input)}>
                  Get real quotes from verified builders <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
