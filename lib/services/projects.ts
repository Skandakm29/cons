import type { Project, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BUSINESS_RULES } from "@/lib/config";
import { notifications } from "./notifications";

export function isBiddingOpen(p: Pick<Project, "status" | "bidDeadline">, now = new Date()): boolean {
  return p.status === "OPEN" && !!p.bidDeadline && p.bidDeadline > now;
}

export function defaultBidDeadline(from = new Date()): Date {
  return new Date(from.getTime() + BUSINESS_RULES.defaultBidWindowDays * 24 * 60 * 60 * 1000);
}

/**
 * Moves OPEN projects past their deadline to UNDER_REVIEW and notifies everyone involved.
 * Called lazily from pages that list projects (no background scheduler in the base version).
 */
export async function closeExpiredBidding(now = new Date()): Promise<number> {
  const expired = await prisma.project.findMany({
    where: { status: "OPEN", bidDeadline: { lte: now } },
    select: { id: true, title: true, homeownerId: true },
  });
  let closed = 0;
  for (const p of expired) {
    await prisma.$transaction(async (tx) => {
      // Conditional update guards against two requests closing the same project.
      const { count } = await tx.project.updateMany({
        where: { id: p.id, status: "OPEN" },
        data: { status: "UNDER_REVIEW" },
      });
      if (count === 0) return;
      closed++;
      const bids = await tx.bid.findMany({
        where: { projectId: p.id, status: { in: ["SUBMITTED", "SHORTLISTED"] } },
        select: { builder: { select: { userId: true } } },
      });
      await notifications.notify(
        p.homeownerId,
        "BIDDING_CLOSED",
        { title: "Bidding closed", body: `Bidding has closed for "${p.title}". Compare the ${bids.length} bids and award a builder.`, href: `/projects/${p.id}` },
        tx,
      );
      await notifications.notify(
        bids.map((b) => b.builder.userId),
        "BIDDING_CLOSED",
        { title: "Bidding closed", body: `Bidding has closed for "${p.title}". The homeowner is reviewing bids.`, href: `/builder/projects/${p.id}` },
        tx,
      );
    });
  }
  return closed;
}

/** Loads a project only if `user` owns it. */
export async function getOwnedProject(projectId: string, user: Pick<User, "id">) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.homeownerId !== user.id) return null;
  return project;
}
