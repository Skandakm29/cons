"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProjectStatus } from "@prisma/client";
import { Loader2, Send, Trash2 } from "lucide-react";
import { cancelProjectAction, publishProjectAction } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function ProjectOwnerActions({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      router.refresh();
    });

  const cancellable = status === "DRAFT" || status === "OPEN" || status === "UNDER_REVIEW";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button disabled={pending} onClick={() => run(() => publishProjectAction(projectId))}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Publish for bids
        </Button>
      )}
      {cancellable && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" disabled={pending}>
              <Trash2 aria-hidden /> Cancel project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel this project?</DialogTitle>
              <DialogDescription>Bidding stops and builders who bid are notified. This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep project</Button>
              </DialogClose>
              <Button variant="destructive" disabled={pending} onClick={() => run(() => cancelProjectAction(projectId))}>
                Cancel project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
