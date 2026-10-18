"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { createProjectAction } from "@/lib/actions/projects";
import { SUPPORTED_CITIES } from "@/lib/config";
import { EXTRA_KEYS, EXTRA_LABELS, PACKAGES } from "@/lib/estimator/types";
import { DEFAULT_ESTIMATOR_CONFIG } from "@/lib/estimator/config";
import { floorsLabel, formatINR, formatINRCompact, formatSqft, humanize } from "@/lib/format";
import { FACINGS, START_TIMELINES, projectSchema, type ProjectInput } from "@/lib/validation/project";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExtrasFields } from "@/components/estimate/extras-fields";
import { cn } from "@/lib/utils";

export type WizardPrefill = Partial<Pick<ProjectInput, "city" | "builtUpAreaSqft" | "floors" | "preferredPackage" | "extras">>;

const STEPS: { title: string; fields: FieldPath<ProjectInput>[] }[] = [
  { title: "Plot", fields: ["title", "city", "locality", "plotLengthFt", "plotWidthFt", "facing"] },
  {
    title: "Requirements",
    fields: ["builtUpAreaSqft", "floors", "bedrooms", "bathrooms", "parking", "vastuRequired", "preferredPackage", "extras"],
  },
  { title: "Budget & timeline", fields: ["budgetMin", "budgetMax", "startTimeline", "notes"] },
  { title: "Review", fields: [] },
];

function stepOfField(path: string): number {
  const i = STEPS.findIndex((s) => s.fields.some((f) => path === f || path.startsWith(`${f}.`)));
  return i === -1 ? STEPS.length - 1 : i;
}

export function ProjectWizard({ prefill }: { prefill: WizardPrefill }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      city: prefill.city ?? "Bengaluru",
      locality: "",
      plotLengthFt: 40,
      plotWidthFt: 60,
      facing: "EAST",
      builtUpAreaSqft: prefill.builtUpAreaSqft ?? 2400,
      floors: prefill.floors ?? 2,
      bedrooms: 3,
      bathrooms: 3,
      parking: true,
      vastuRequired: false,
      preferredPackage: prefill.preferredPackage ?? "STANDARD",
      extras: { basement: false, lift: false, compoundWall: false, sump: false, solar: false, ...prefill.extras },
      budgetMin: 4_000_000,
      budgetMax: 5_500_000,
      startTimeline: "1–3 months",
      notes: "",
      publish: true,
    },
  });
  const { register, formState, watch } = form;
  const { errors, isSubmitting } = formState;
  const v = watch();

  async function next() {
    const valid = await form.trigger(STEPS[step].fields);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit(publish: boolean) {
    setServerError(null);
    form.setValue("publish", publish);
    await form.handleSubmit(
      async (values) => {
        const res = await createProjectAction(values);
        if (!res.ok) {
          setServerError(res.error);
          const first = Object.keys(res.fieldErrors ?? {})[0];
          if (first) setStep(stepOfField(first));
          return;
        }
        router.push(`/projects/${res.data.projectId}?created=1`);
      },
      (errs) => {
        // Cross-field checks (e.g. built-up area vs plot) can fail on review; jump to the step.
        const first = Object.keys(errs)[0];
        if (first) setStep(stepOfField(first));
      },
    )();
  }

  const err = (path: string): string | undefined => {
    const parts = path.split(".");
    let node: unknown = errors;
    for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
    return (node as { message?: string } | undefined)?.message;
  };

  const num = (name: FieldPath<ProjectInput>, label: string, hint?: string) => (
    <Field id={name} label={label} hint={hint} error={err(name)}>
      <Input {...fieldAria(name, err(name))} type="number" inputMode="numeric" {...register(name, { valueAsNumber: true })} />
    </Field>
  );

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
              className="w-full text-left"
            >
              <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("mt-1.5 block text-xs font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="pt-6 sm:pt-6">
          <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="title" label="Project title" className="sm:col-span-2" error={err("title")}>
                  <Input {...fieldAria("title", err("title"))} placeholder="e.g. G+1 family home in Whitefield" {...register("title")} />
                </Field>
                <Field id="city" label="City" error={err("city")}>
                  <Select {...fieldAria("city", err("city"))} {...register("city")}>
                    {SUPPORTED_CITIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="locality" label="Locality" error={err("locality")}>
                  <Input {...fieldAria("locality", err("locality"))} placeholder="e.g. HSR Layout" {...register("locality")} />
                </Field>
                {num("plotLengthFt", "Plot length (ft)")}
                {num("plotWidthFt", "Plot width (ft)")}
                <Field id="facing" label="Plot facing" error={err("facing")}>
                  <Select {...fieldAria("facing", err("facing"))} {...register("facing")}>
                    {FACINGS.map((f) => (
                      <option key={f} value={f}>
                        {humanize(f)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <p className="rounded-md bg-muted px-3 py-2 text-sm">
                    Plot area: <strong>{formatSqft((v.plotLengthFt || 0) * (v.plotWidthFt || 0))}</strong>
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {num("builtUpAreaSqft", "Total built-up area (sqft)", "All floors combined")}
                <Field id="floors" label="Floors" error={err("floors")}>
                  <Select {...fieldAria("floors", err("floors"))} {...register("floors", { valueAsNumber: true })}>
                    {Array.from({ length: DEFAULT_ESTIMATOR_CONFIG.maxFloors }, (_, i) => i + 1).map((f) => (
                      <option key={f} value={f}>
                        {floorsLabel(f)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {num("bedrooms", "Bedrooms")}
                {num("bathrooms", "Bathrooms")}
                <Field id="preferredPackage" label="Preferred package" className="sm:col-span-2" error={err("preferredPackage")}>
                  <Select {...fieldAria("preferredPackage", err("preferredPackage"))} {...register("preferredPackage")}>
                    {PACKAGES.map((p) => (
                      <option key={p} value={p}>
                        {humanize(p)} — {DEFAULT_ESTIMATOR_CONFIG.packageBlurbs[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Checkbox label="Car parking" {...register("parking")} />
                <Checkbox label="Vastu-compliant layout" {...register("vastuRequired")} />
                <div className="sm:col-span-2">
                  <ExtrasFields register={register} error={err("extras.lift")} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="budgetMin" label="Minimum budget (₹)" hint={v.budgetMin ? `${formatINR(v.budgetMin)} (${formatINRCompact(v.budgetMin)})` : undefined} error={err("budgetMin")}>
                  <Input {...fieldAria("budgetMin", err("budgetMin"))} type="number" inputMode="numeric" step={100000} {...register("budgetMin", { valueAsNumber: true })} />
                </Field>
                <Field id="budgetMax" label="Maximum budget (₹)" hint={v.budgetMax ? `${formatINR(v.budgetMax)} (${formatINRCompact(v.budgetMax)})` : undefined} error={err("budgetMax")}>
                  <Input {...fieldAria("budgetMax", err("budgetMax"))} type="number" inputMode="numeric" step={100000} {...register("budgetMax", { valueAsNumber: true })} />
                </Field>
                <Field id="startTimeline" label="When do you want to start?" className="sm:col-span-2" error={err("startTimeline")}>
                  <Select {...fieldAria("startTimeline", err("startTimeline"))} {...register("startTimeline")}>
                    {START_TIMELINES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="notes" label="Anything builders should know? (optional)" className="sm:col-span-2" error={err("notes")}>
                  <Textarea {...fieldAria("notes", err("notes"))} rows={4} placeholder="Special rooms, accessibility needs, existing structure to demolish…" {...register("notes")} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Summary label="Title" value={v.title} />
                  <Summary label="Location" value={`${v.locality}, ${v.city}`} />
                  <Summary label="Plot" value={`${v.plotLengthFt} × ${v.plotWidthFt} ft (${formatSqft(v.plotLengthFt * v.plotWidthFt)}), ${humanize(v.facing)} facing`} />
                  <Summary label="Built-up" value={`${formatSqft(v.builtUpAreaSqft)} · ${floorsLabel(v.floors)}`} />
                  <Summary label="Rooms" value={`${v.bedrooms} bed · ${v.bathrooms} bath${v.parking ? " · parking" : ""}${v.vastuRequired ? " · vastu" : ""}`} />
                  <Summary label="Package" value={humanize(v.preferredPackage)} />
                  <Summary label="Extras" value={EXTRA_KEYS.filter((k) => v.extras[k]).map((k) => EXTRA_LABELS[k]).join(", ") || "None"} />
                  <Summary label="Budget" value={`${formatINRCompact(v.budgetMin)} – ${formatINRCompact(v.budgetMax)}`} />
                  <Summary label="Start" value={v.startTimeline} />
                </dl>
                <Alert variant="info">
                  Publishing opens bidding to verified builders for 7 days. Your phone number stays hidden until you award the project.
                </Alert>
              </div>
            )}

            {serverError && <Alert variant="danger">{serverError}</Alert>}

            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || isSubmitting}>
                <ArrowLeft aria-hidden /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>
                  Next <ArrowRight aria-hidden />
                </Button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => submit(false)} disabled={isSubmitting}>
                    Save as draft
                  </Button>
                  <Button type="button" onClick={() => submit(true)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Publish & get estimate
                  </Button>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
