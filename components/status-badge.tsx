import type { BidStatus, ProjectStatus, VerificationStatus } from "@prisma/client";
import { BadgeCheck } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Variant = NonNullable<BadgeProps["variant"]>;

const PROJECT: Record<ProjectStatus, Variant> = {
  DRAFT: "secondary",
  OPEN: "info",
  UNDER_REVIEW: "warning",
  AWARDED: "success",
  CLOSED: "secondary",
  CANCELLED: "danger",
};
const BID: Record<BidStatus, Variant> = {
  SUBMITTED: "info",
  SHORTLISTED: "warning",
  REJECTED: "danger",
  AWARDED: "success",
  WITHDRAWN: "secondary",
};
const VERIFICATION: Record<VerificationStatus, Variant> = { PENDING: "warning", VERIFIED: "success", REJECTED: "danger" };

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT[status]}>{status === "OPEN" ? "Open for bids" : humanize(status)}</Badge>;
}
export function BidStatusBadge({ status }: { status: BidStatus }) {
  return <Badge variant={BID[status]}>{humanize(status)}</Badge>;
}
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <Badge variant={VERIFICATION[status]}>
      {status === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
      {status === "VERIFIED" ? "Verified builder" : humanize(status)}
    </Badge>
  );
}
