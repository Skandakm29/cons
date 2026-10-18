import type { UseFormRegister, FieldValues, Path } from "react-hook-form";
import { EXTRA_KEYS, EXTRA_LABELS } from "@/lib/estimator/types";
import { Checkbox } from "@/components/ui/checkbox";

/** Checkbox group for estimator extras; works with any form that has an `extras` object. */
export function ExtrasFields<T extends FieldValues>({ register, error }: { register: UseFormRegister<T>; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Extras (optional)</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {EXTRA_KEYS.map((k) => (
          <Checkbox key={k} label={EXTRA_LABELS[k]} {...register(`extras.${k}` as Path<T>)} />
        ))}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </fieldset>
  );
}
