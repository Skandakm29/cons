"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { updateRateAction } from "@/lib/actions/admin";
import { BREAKDOWN_CATEGORIES, CATEGORY_LABELS } from "@/lib/estimator/types";
import { formatDateTime, humanize } from "@/lib/format";
import { rateSchema, type RateInput } from "@/lib/validation/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function RateEditor({ initial, updatedAt }: { initial: RateInput; updatedAt: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<RateInput>({ resolver: zodResolver(rateSchema), defaultValues: initial });
  const { errors, isSubmitting, isDirty } = form.formState;
  const percents = form.watch("breakdownPercents");
  const sum = Math.round(BREAKDOWN_CATEGORIES.reduce((s, c) => s + (Number(percents[c]) || 0), 0) * 100) / 100;
  const prefix = `${initial.city}-${initial.package}`;

  return (
    <form
      noValidate
      className="space-y-3 rounded-lg border bg-card p-4"
      onSubmit={form.handleSubmit(async (v) => {
        setStatus(null);
        const res = await updateRateAction(v);
        setStatus(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: res.error });
        if (res.ok) {
          form.reset(v);
          router.refresh();
        }
      })}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">{humanize(initial.package)}</h3>
          <p className="text-xs text-muted-foreground">Updated {formatDateTime(updatedAt)}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor={`${prefix}-low`} className="text-xs font-medium">Low ₹/sqft</label>
            <Input id={`${prefix}-low`} type="number" className="h-9 w-28" aria-invalid={errors.ratePerSqftLow ? true : undefined} {...form.register("ratePerSqftLow", { valueAsNumber: true })} />
          </div>
          <div>
            <label htmlFor={`${prefix}-high`} className="text-xs font-medium">High ₹/sqft</label>
            <Input id={`${prefix}-high`} type="number" className="h-9 w-28" aria-invalid={errors.ratePerSqftHigh ? true : undefined} {...form.register("ratePerSqftHigh", { valueAsNumber: true })} />
          </div>
        </div>
      </div>
      {(errors.ratePerSqftLow || errors.ratePerSqftHigh) && (
        <p className="text-xs text-destructive">{errors.ratePerSqftLow?.message ?? errors.ratePerSqftHigh?.message}</p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Breakdown percentages <span className={cn("ml-1", sum === 100 ? "text-emerald-700" : "text-amber-700")}>(total {sum}%)</span></summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {BREAKDOWN_CATEGORIES.map((c) => (
            <div key={c}>
              <label htmlFor={`${prefix}-${c}`} className="text-xs text-muted-foreground">{CATEGORY_LABELS[c]}</label>
              <Input id={`${prefix}-${c}`} type="number" step="0.5" className="h-9" {...form.register(`breakdownPercents.${c}`, { valueAsNumber: true })} />
            </div>
          ))}
        </div>
        {errors.breakdownPercents?.root?.message || errors.breakdownPercents?.message ? (
          <p className="mt-1 text-xs text-destructive">{errors.breakdownPercents?.root?.message ?? errors.breakdownPercents?.message}</p>
        ) : null}
      </details>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save</Button>
        {status && <span className={cn("text-sm", status.ok ? "text-emerald-700" : "text-destructive")} role="status">{status.text}</span>}
      </div>
    </form>
  );
}
