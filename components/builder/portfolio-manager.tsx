"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addPortfolioItemAction, deletePortfolioItemAction } from "@/lib/actions/builder";
import { formatSqft } from "@/lib/format";
import { portfolioItemSchema, type PortfolioItemInput } from "@/lib/validation/builder";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { FileUpload } from "@/components/file-upload";

export interface PortfolioRow {
  id: string;
  title: string;
  city: string;
  areaSqft: number;
  completedYear: number;
  imageUrls: string[];
}

export function PortfolioManager({ items, enabled }: { items: PortfolioRow[]; enabled: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blank: PortfolioItemInput = { title: "", city: "Bengaluru", areaSqft: 2000, completedYear: new Date().getFullYear(), description: "", imageUrls: [] };
  const form = useForm<PortfolioItemInput>({ resolver: zodResolver(portfolioItemSchema), defaultValues: blank });
  const { errors, isSubmitting } = form.formState;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState title="No portfolio projects yet" description="Add 2–3 completed homes with photos. Homeowners see these on your bids." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-lg border bg-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrls[0]} alt={p.title} className="h-20 w-28 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{p.title}</p>
                <p className="text-muted-foreground">{p.city} · {formatSqft(p.areaSqft)} · {p.completedYear}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${p.title}`}
                disabled={pending}
                onClick={() => start(async () => { const r = await deletePortfolioItemAction(p.id); if (!r.ok) setError(r.error); router.refresh(); })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!enabled ? (
        <p className="text-sm text-muted-foreground">Save your company profile first to add portfolio projects.</p>
      ) : adding ? (
        <form
          noValidate
          className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit(async (v) => {
            setError(null);
            const res = await addPortfolioItemAction(v);
            if (!res.ok) return setError(res.error);
            form.reset(blank);
            setAdding(false);
            router.refresh();
          })}
        >
          <Field id="pf-title" label="Project title" className="sm:col-span-2" error={errors.title?.message}>
            <Input {...fieldAria("pf-title", errors.title?.message)} {...form.register("title")} />
          </Field>
          <Field id="pf-city" label="City" error={errors.city?.message}>
            <Input {...fieldAria("pf-city", errors.city?.message)} {...form.register("city")} />
          </Field>
          <Field id="pf-area" label="Built-up area (sqft)" error={errors.areaSqft?.message}>
            <Input {...fieldAria("pf-area", errors.areaSqft?.message)} type="number" {...form.register("areaSqft", { valueAsNumber: true })} />
          </Field>
          <Field id="pf-year" label="Year completed" error={errors.completedYear?.message}>
            <Input {...fieldAria("pf-year", errors.completedYear?.message)} type="number" {...form.register("completedYear", { valueAsNumber: true })} />
          </Field>
          <Field id="pf-desc" label="Description (optional)" className="sm:col-span-2" error={errors.description?.message}>
            <Textarea {...fieldAria("pf-desc")} rows={2} {...form.register("description")} />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Photos</span>
            <Controller
              control={form.control}
              name="imageUrls"
              render={({ field }) => <FileUpload folder="portfolio" value={field.value} onChange={field.onChange} error={errors.imageUrls?.message} />}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Add to portfolio</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}><Plus aria-hidden /> Add portfolio project</Button>
      )}
    </div>
  );
}
