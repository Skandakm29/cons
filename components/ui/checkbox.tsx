import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: React.ReactNode; description?: string };

/** Native checkbox with an attached label (whole row is clickable). */
export const Checkbox = React.forwardRef<HTMLInputElement, Props>(({ className, label, description, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border border-input bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent",
        className,
      )}
    >
      <input ref={ref} id={inputId} type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" {...props} />
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";
