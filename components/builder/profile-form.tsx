"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { saveBuilderProfileAction } from "@/lib/actions/builder";
import { SUPPORTED_CITIES } from "@/lib/config";
import { builderProfileSchema, type BuilderProfileInput } from "@/lib/validation/builder";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/file-upload";

export function BuilderProfileForm({ initial }: { initial: BuilderProfileInput | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<BuilderProfileInput>({
    resolver: zodResolver(builderProfileSchema),
    defaultValues: initial ?? { companyName: "", yearsOfExperience: 0, citiesServed: ["Bengaluru"], gstNumber: "", licenseDocUrl: "", about: "" },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={form.handleSubmit(async (v) => {
        setMsg(null);
        const res = await saveBuilderProfileAction(v);
        setMsg(res.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: res.error });
        if (res.ok) router.refresh();
      })}
    >
      <Field id="companyName" label="Company name" error={errors.companyName?.message}>
        <Input {...fieldAria("companyName", errors.companyName?.message)} {...form.register("companyName")} />
      </Field>
      <Field id="yearsOfExperience" label="Years of experience" error={errors.yearsOfExperience?.message}>
        <Input {...fieldAria("yearsOfExperience", errors.yearsOfExperience?.message)} type="number" inputMode="numeric" {...form.register("yearsOfExperience", { valueAsNumber: true })} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">Cities served</legend>
        <div className="flex flex-wrap gap-2">
          <Controller
            control={form.control}
            name="citiesServed"
            render={({ field }) => (
              <>
                {SUPPORTED_CITIES.map((c) => (
                  <Checkbox
                    key={c}
                    label={c}
                    checked={field.value.includes(c)}
                    onChange={(e) => field.onChange(e.target.checked ? [...field.value, c] : field.value.filter((x) => x !== c))}
                  />
                ))}
              </>
            )}
          />
        </div>
        {errors.citiesServed && <p className="mt-1 text-xs text-destructive">{errors.citiesServed.message}</p>}
      </fieldset>
      <Field id="gstNumber" label="GSTIN (optional)" hint="15 characters, e.g. 29ABCDE1234F1Z5" error={errors.gstNumber?.message}>
        <Input {...fieldAria("gstNumber", errors.gstNumber?.message)} className="uppercase" {...form.register("gstNumber")} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Trade licence / registration (PDF or image)</span>
        <Controller
          control={form.control}
          name="licenseDocUrl"
          render={({ field }) => (
            <FileUpload
              folder="documents"
              max={1}
              accept="application/pdf,image/jpeg,image/png"
              label="Upload document"
              value={field.value ? [field.value] : []}
              onChange={(urls) => field.onChange(urls[0] ?? "")}
              error={errors.licenseDocUrl?.message}
            />
          )}
        />
      </div>
      <Field id="about" label="About your company" className="sm:col-span-2" error={errors.about?.message}>
        <Textarea {...fieldAria("about", errors.about?.message)} rows={4} {...form.register("about")} />
      </Field>
      {msg && <Alert variant={msg.ok ? "success" : "danger"} className="sm:col-span-2">{msg.text}</Alert>}
      <Button type="submit" disabled={isSubmitting} className="sm:col-span-2 sm:justify-self-start">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save profile
      </Button>
    </form>
  );
}
