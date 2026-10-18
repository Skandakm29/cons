"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BidStatus } from "@prisma/client";
import { Award, Loader2, MessageSquare, Star, Undo2, X } from "lucide-react";
import { awardBidAction, decideBidAction } from "@/lib/actions/bids";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BidActions({
  bidId,
  status,
  builderName,
  totalPrice,
  canDecide,
  compact = false,
}: {
  bidId: string;
  status: BidStatus;
  builderName: string;
  totalPrice: number;
  canDecide: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setOpen(false);
        router.refresh();
      }
    });

  const live = status === "SUBMITTED" || status === "SHORTLISTED";
  const size = compact ? "sm" : "sm";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size={size}>
          <Link href={`/bids/${bidId}`}>
            <MessageSquare aria-hidden /> {compact ? "Chat" : "Message"}
          </Link>
        </Button>
        {canDecide && live && (
          <>
            {status === "SUBMITTED" ? (
              <Button variant="secondary" size={size} disabled={pending} onClick={() => run(() => decideBidAction({ bidId, decision: "SHORTLISTED" }))}>
                <Star aria-hidden /> Shortlist
              </Button>
            ) : (
              <Button variant="secondary" size={size} disabled={pending} onClick={() => run(() => decideBidAction({ bidId, decision: "SUBMITTED" }))}>
                <Undo2 aria-hidden /> Un-shortlist
              </Button>
            )}
            <Button variant="ghost" size={size} disabled={pending} onClick={() => run(() => decideBidAction({ bidId, decision: "REJECTED" }))}>
              <X aria-hidden /> Reject
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size={size} disabled={pending}>
                  <Award aria-hidden /> Award
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Award this project to {builderName}?</DialogTitle>
                  <DialogDescription>
                    Their bid of <strong>{formatINR(totalPrice)}</strong> will be accepted. Bidding closes immediately, all other
                    builders are notified and their bids are marked rejected. Contact details are then shared between you and{" "}
                    {builderName}. This can&apos;t be undone.
                  </DialogDescription>
                </DialogHeader>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button disabled={pending} onClick={() => run(() => awardBidAction(bidId))}>
                    {pending && <Loader2 className="animate-spin" aria-hidden />} Yes, award project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {canDecide && status === "REJECTED" && (
          <Button variant="ghost" size={size} disabled={pending} onClick={() => run(() => decideBidAction({ bidId, decision: "SUBMITTED" }))}>
            <Undo2 aria-hidden /> Reconsider
          </Button>
        )}
      </div>
      {error && !open && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
