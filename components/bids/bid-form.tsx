"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { submitBidAction } from "@/lib/actions/bids";
import { distributeByPercents } from "@/lib/estimator";
import { BREAKDOWN_CATEGORIES, CATEGORY_LABELS, type BreakdownPercents } from "@/lib/estimator/types";
import { formatINR, formatINRCompact, humanize } from "@/lib/format";
import { DEMO_TYPES, MATERIAL_FIELDS, bidSchema, type BidFormValues, type BidInput } from "@/lib/validation/bid";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/file-upload";
import { cn } from "@/lib/utils";

const DEMO_HELP: Record<(typeof DEMO_TYPES)[number], string> = {
  PORTFOLIO: "Pick completed projects from your portfolio.",
  DESIGN_LINK: "Link a sample design, elevation or 3D walkthrough for this project.",
  VIDEO: "Link a video walkthrough of a similar home you built.",
  IMAGES: "Upload photos or a sample elevation for this project.",
};

/** Reads `message` or a field-array `root.message` from an RHF error node. */
function msg(e: unknown): string | undefined {
  const node = e as { message?: string; root?: { message?: string } } | undefined;
  return node?.message ?? node?.root?.message;
}

export function BidForm({
  initial,
  percents,
  benchmark,
  portfolio,
  isRevision,
}: {
  initial: BidFormValues;
  percents: BreakdownPercents;
  benchmark: { low: number; high: number };
  portfolio: { id: string; title: string; imageUrls: string[] }[];
  isRevision: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const form = useForm<BidFormValues, unknown, BidInput>({ resolver: zodResolver(bidSchema), defaultValues: initial, mode: "onTouched" });
  const { register, control, watch, setValue, formState } = form;
  const errors: FieldErrors<BidFormValues> = formState.errors;
  const milestones = useFieldArray({ control, name: "paymentMilestones" });

  const total = watch("totalPrice") || 0;
  const breakdown = watch("breakdown");
  const breakdownSum = BREAKDOWN_CATEGORIES.reduce((s, c) => s + (Number(breakdown?.[c]) || 0), 0);
  const msSum = (watch("paymentMilestones") ?? []).reduce((s, m) => s + (Number(m.percent) || 0), 0);
  const demoType = watch("demoType");

  function redistribute() {
    if (!total || total <= 0) return;
    const parts = distributeByPercents(Math.round(total), percents);
    for (const c of BREAKDOWN_CATEGORIES) setValue(`breakdown.${c}`, parts[c], { shouldValidate: false });
    void form.trigger("breakdown");
  }

  async function onSubmit(values: BidInput) {
    setServerError(null);
    setSaved(null);
    const res = await submitBidAction(values);
    if (!res.ok) return setServerError(res.error);
    setSaved(res.data.revised ? "Bid updated. The previous version was saved to your revision history." : "Bid submitted! The homeowner has been notified.");
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your price</CardTitle>
          <CardDescription>
            Our benchmark: {formatINR(benchmark.low)} – {formatINR(benchmark.high)}. Other builders can&apos;t see your price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="totalPrice" label="Total price (₹)" hint={total ? formatINRCompact(total) : undefined} error={errors.totalPrice?.message}>
              <Input {...fieldAria("totalPrice", errors.totalPrice?.message)} type="number" inputMode="numeric" step={10000} {...register("totalPrice", { valueAsNumber: true })} />
            </Field>
            <Field id="timelineWeeks" label="Timeline (weeks)" error={errors.timelineWeeks?.message}>
              <Input {...fieldAria("timelineWeeks", errors.timelineWeeks?.message)} type="number" inputMode="numeric" {...register("timelineWeeks", { valueAsNumber: true })} />
            </Field>
            <Field id="warrantyYears" label="Structural warranty (years)" error={errors.warrantyYears?.message}>
              <Input {...fieldAria("warrantyYears", errors.warrantyYears?.message)} type="number" inputMode="numeric" {...register("warrantyYears", { valueAsNumber: true })} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Cost breakdown</h4>
              <Button type="button" variant="outline" size="sm" onClick={redistribute}>
                <RefreshCw aria-hidden /> Split total by our benchmark %
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-2 font-medium">Category</th>
                    <th scope="col" className="p-2 font-medium">Benchmark %</th>
                    <th scope="col" className="p-2 font-medium">Your amount (₹)</th>
                    <th scope="col" className="p-2 font-medium">Your %</th>
                  </tr>
                </thead>
                <tbody>
                  {BREAKDOWN_CATEGORIES.map((c) => {
                    const amt = Number(breakdown?.[c]) || 0;
                    return (
                      <tr key={c} className="border-t">
                        <th scope="row" className="p-2 text-left font-normal">
                          <label htmlFor={`bd-${c}`}>{CATEGORY_LABELS[c]}</label>
                        </th>
                        <td className="p-2 tabular-nums text-muted-foreground">{percents[c]}%</td>
                        <td className="p-2">
                          <Input
                            id={`bd-${c}`}
                            type="number"
                            inputMode="numeric"
                            className="h-9 min-w-[8rem]"
                            aria-invalid={errors.breakdown?.[c] ? true : undefined}
                            {...register(`breakdown.${c}`, { valueAsNumber: true })}
                          />
                        </td>
                        <td className="p-2 tabular-nums text-muted-foreground">{total ? `${Math.round((amt / total) * 1000) / 10}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={cn("border-t font-semibold", breakdownSum === total ? "bg-emerald-50" : "bg-amber-50")}>
                    <td className="p-2">Total</td>
                    <td className="p-2">100%</td>
                    <td className="p-2 tabular-nums">{formatINR(breakdownSum)}</td>
                    <td className="p-2 text-xs font-medium">
                      {breakdownSum === total ? "Matches total ✓" : `${breakdownSum > total ? "+" : ""}${formatINR(breakdownSum - total)} vs total`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {msg(errors.breakdown) && <p className="mt-1 text-xs font-medium text-destructive" role="alert">{msg(errors.breakdown)}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materials & brands</CardTitle>
          <CardDescription>Be specific — homeowners compare these line by line.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {MATERIAL_FIELDS.map(([key, label, placeholder]) => (
            <Field key={key} id={`mat-${key}`} label={label} error={errors.materialsSpec?.[key]?.message}>
              <Input {...fieldAria(`mat-${key}`, errors.materialsSpec?.[key]?.message)} placeholder={placeholder} {...register(`materialsSpec.${key}`)} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment milestones</CardTitle>
          <CardDescription>Must total exactly 100%. Pre-filled with our recommended schedule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2">
            {milestones.fields.map((f, i) => (
              <li key={f.id} className="flex items-start gap-2">
                <span className="mt-2.5 w-5 text-right text-xs text-muted-foreground">{i + 1}.</span>
                <div className="flex-1">
                  <label htmlFor={`ms-name-${i}`} className="sr-only">Milestone {i + 1} name</label>
                  <Input id={`ms-name-${i}`} aria-invalid={errors.paymentMilestones?.[i]?.name ? true : undefined} {...register(`paymentMilestones.${i}.name`)} />
                  {errors.paymentMilestones?.[i]?.name && <p className="mt-1 text-xs text-destructive">{errors.paymentMilestones[i]?.name?.message}</p>}
                </div>
                <div className="w-24">
                  <label htmlFor={`ms-pct-${i}`} className="sr-only">Milestone {i + 1} percent</label>
                  <div className="relative">
                    <Input id={`ms-pct-${i}`} type="number" inputMode="numeric" className="pr-7" aria-invalid={errors.paymentMilestones?.[i]?.percent ? true : undefined} {...register(`paymentMilestones.${i}.percent`, { valueAsNumber: true })} />
                    <span className="pointer-events-none absolute right-2.5 top-2.5 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove milestone ${i + 1}`} onClick={() => milestones.remove(i)} disabled={milestones.fields.length <= 2}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => milestones.append({ name: "", percent: 0 })} disabled={milestones.fields.length >= 12}>
              <Plus aria-hidden /> Add milestone
            </Button>
            <span className={cn("text-sm font-semibold", msSum === 100 ? "text-emerald-700" : "text-amber-700")} aria-live="polite">
              Total: {msSum}% {msSum === 100 ? "✓" : `(${100 - msSum > 0 ? `${100 - msSum}% left` : `${msSum - 100}% over`})`}
            </span>
          </div>
          {msg(errors.paymentMilestones) && <p className="text-xs font-medium text-destructive" role="alert">{msg(errors.paymentMilestones)}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo of your work</CardTitle>
          <CardDescription>Show the homeowner what they&apos;ll get.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="sr-only">Demo type</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEMO_TYPES.map((t) => (
                <label key={t} className="cursor-pointer rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
                  <input
                    type="radio"
                    value={t}
                    className="sr-only"
                    {...register("demoType", { onChange: () => setValue("demoUrls", []) })}
                  />
                  <span className="font-medium">{humanize(t)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-sm text-muted-foreground">{DEMO_HELP[demoType]}</p>

          {demoType === "IMAGES" && (
            <Controller
              control={control}
              name="demoUrls"
              render={({ field }) => <FileUpload folder="bids" value={field.value} onChange={field.onChange} max={8} error={msg(errors.demoUrls)} />}
            />
          )}
          {(demoType === "DESIGN_LINK" || demoType === "VIDEO") && (
            <Controller
              control={control}
              name="demoUrls"
              render={({ field }) => (
                <div className="space-y-2">
                  {(field.value.length ? field.value : [""]).map((u, i) => (
                    <div key={i} className="flex gap-2">
                      <label htmlFor={`demo-url-${i}`} className="sr-only">Link {i + 1}</label>
                      <Input
                        id={`demo-url-${i}`}
                        type="url"
                        placeholder="https://"
                        value={u}
                        aria-invalid={errors.demoUrls?.[i] ? true : undefined}
                        onChange={(e) => {
                          const next = field.value.length ? [...field.value] : [""];
                          next[i] = e.target.value;
                          field.onChange(next);
                        }}
                      />
                      {field.value.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} onClick={() => field.onChange(field.value.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([...(field.value.length ? field.value : [""]), ""])}>
                    <Plus aria-hidden /> Add another link
                  </Button>
                  {(msg(errors.demoUrls) || errors.demoUrls?.[0]) && (
                    <p className="text-xs font-medium text-destructive" role="alert">{msg(errors.demoUrls) ?? "Enter valid http(s) links"}</p>
                  )}
                </div>
              )}
            />
          )}
          {demoType === "PORTFOLIO" &&
            (portfolio.length === 0 ? (
              <Alert variant="warning">You have no portfolio projects yet. Add some from your profile, or choose another demo type.</Alert>
            ) : (
              <Controller
                control={control}
                name="demoPortfolioItemIds"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {portfolio.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
                        <input
                          type="checkbox"
                          className="accent-[hsl(var(--primary))]"
                          checked={field.value.includes(p.id)}
                          onChange={(e) => field.onChange(e.target.checked ? [...field.value, p.id] : field.value.filter((x) => x !== p.id))}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className="h-12 w-16 rounded object-cover" />}
                        <span>{p.title}</span>
                      </label>
                    ))}
                    {msg(errors.demoPortfolioItemIds) && <p className="text-xs font-medium text-destructive sm:col-span-2" role="alert">{msg(errors.demoPortfolioItemIds)}</p>}
                  </div>
                )}
              />
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cover note</CardTitle>
        </CardHeader>
        <CardContent>
          <Field id="coverNote" label="Why should the homeowner pick you?" error={errors.coverNote?.message}>
            <Textarea {...fieldAria("coverNote", errors.coverNote?.message)} rows={5} placeholder="Relevant experience, what's included and excluded, site supervision, approvals…" {...register("coverNote")} />
          </Field>
        </CardContent>
      </Card>

      {serverError && <Alert variant="danger">{serverError}</Alert>}
      {saved && <Alert variant="success">{saved}</Alert>}
      {Object.keys(errors).length > 0 && !serverError && <Alert variant="danger">Please fix the highlighted fields above.</Alert>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} {isRevision ? "Update bid" : "Submit bid"}
      </Button>
    </form>
  );
}
