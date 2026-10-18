"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Star } from "lucide-react";
import { z } from "zod";
import { createReviewAction } from "@/lib/actions/bids";
import { reviewSchema } from "@/lib/validation/bid";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Values = z.infer<typeof reviewSchema>;

export function ReviewForm({ projectId, builderName }: { projectId: string; builderName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(reviewSchema), defaultValues: { projectId, rating: 5, comment: "" } });
  const rating = form.watch("rating");

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        const res = await createReviewAction(v);
        if (!res.ok) return setError(res.error);
        router.refresh();
      })}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Rate {builderName}</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-1">
              <input type="radio" className="sr-only" value={n} {...form.register("rating", { valueAsNumber: true })} />
              <Star className={cn("h-7 w-7", n <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} aria-hidden />
              <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="review-comment" label="Comment (optional)" error={form.formState.errors.comment?.message}>
        <Textarea {...fieldAria("review-comment")} rows={3} {...form.register("comment")} />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Submit review
      </Button>
    </form>
  );
}
