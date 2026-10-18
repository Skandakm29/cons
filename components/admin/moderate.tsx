"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moderateBidAction, moderateProjectAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Target = { kind: "project"; id: string; action: "CANCEL" | "REOPEN" } | { kind: "bid"; id: string };

/** Inline "action + required note" control for moderation. */
export function ModerateControl({ target, label, variant = "outline" }: { target: Target; label: string; variant?: "outline" | "destructive" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <label htmlFor={`note-${target.id}`} className="sr-only">Moderation note</label>
      <Input id={`note-${target.id}`} className="h-9" placeholder="Note (shown to users)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = target.kind === "project"
              ? await moderateProjectAction({ projectId: target.id, action: target.action, note })
              : await moderateBidAction({ bidId: target.id, note });
            if (!res.ok) return setError(res.error);
            setOpen(false);
            router.refresh();
          })
        }
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
