"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { verifyBuilderAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyBuilder({ builderId }: { builderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "VERIFIED" | "REJECTED") =>
    start(async () => {
      setError(null);
      const res = await verifyBuilderAction({ builderId, decision, reason: decision === "REJECTED" ? reason : undefined });
      if (!res.ok) return setError(res.error);
      setRejecting(false);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {rejecting ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`reason-${builderId}`} className="sr-only">Rejection reason</label>
          <Input id={`reason-${builderId}`} placeholder="Reason shown to the builder" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="destructive" size="sm" disabled={pending} onClick={() => decide("REJECTED")}>Confirm reject</Button>
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => decide("VERIFIED")}><Check aria-hidden /> Approve</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}><X aria-hidden /> Reject</Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
