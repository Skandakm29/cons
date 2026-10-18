import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="container py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="grid gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
