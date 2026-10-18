"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActionUser } from "@/lib/auth/session";
import { formatINR } from "@/lib/format";
import { contactUnlocked, getBidForParticipant, redactContacts } from "@/lib/services/access";
import { notifications } from "@/lib/services/notifications";
import { isBiddingOpen } from "@/lib/services/projects";
import { bidDecisionSchema, bidSchema, messageSchema, reviewSchema } from "@/lib/validation/bid";
import { idSchema } from "@/lib/validation/common";
import { ActionError, runAction, type ActionResult } from "./result";

async function requireVerifiedBuilder() {
  const user = await requireActionUser(["BUILDER"]);
  const profile = await prisma.builderProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ActionError("Complete your builder profile first");
  if (profile.verificationStatus !== "VERIFIED") throw new ActionError("Only verified builders can bid");
  return { user, profile };
}

export async function submitBidAction(input: unknown): Promise<ActionResult<{ bidId: string; revised: boolean }>> {
  return runAction(async () => {
    const { profile } = await requireVerifiedBuilder();
    const v = bidSchema.parse(input);

    const project = await prisma.project.findUnique({ where: { id: v.projectId } });
    if (!project) throw new ActionError("Project not found");
    if (!isBiddingOpen(project)) throw new ActionError("Bidding is closed for this project");
    if (!profile.citiesServed.includes(project.city)) {
      throw new ActionError(`Add ${project.city} to the cities you serve before bidding`);
    }
    if (v.demoPortfolioItemIds.length > 0) {
      const owned = await prisma.portfolioItem.count({
        where: { id: { in: v.demoPortfolioItemIds }, builderId: profile.id },
      });
      if (owned !== v.demoPortfolioItemIds.length) throw new ActionError("Pick portfolio items from your own profile");
    }

    const data = {
      totalPrice: v.totalPrice,
      breakdown: v.breakdown,
      timelineWeeks: v.timelineWeeks,
      materialsSpec: v.materialsSpec,
      warrantyYears: v.warrantyYears,
      paymentMilestones: v.paymentMilestones,
      demoType: v.demoType,
      demoUrls: v.demoType === "PORTFOLIO" ? [] : v.demoUrls,
      demoPortfolioItemIds: v.demoType === "PORTFOLIO" ? v.demoPortfolioItemIds : [],
      coverNote: v.coverNote,
    };

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.bid.findUnique({
        where: { projectId_builderId: { projectId: project.id, builderId: profile.id } },
      });
      if (!existing) {
        const bid = await tx.bid.create({ data: { ...data, projectId: project.id, builderId: profile.id } });
        return { bid, revised: false };
      }
      if (existing.status === "REJECTED" || existing.status === "AWARDED") {
        throw new ActionError("This bid can no longer be edited");
      }
      // Snapshot the previous version before overwriting it.
      await tx.bidRevision.create({
        data: {
          bidId: existing.id,
          revisionNumber: existing.revisionCount + 1,
          totalPrice: existing.totalPrice,
          breakdown: existing.breakdown ?? {},
          timelineWeeks: existing.timelineWeeks,
          materialsSpec: existing.materialsSpec ?? {},
          warrantyYears: existing.warrantyYears,
          paymentMilestones: existing.paymentMilestones ?? [],
          demoType: existing.demoType,
          demoUrls: existing.demoUrls,
          coverNote: existing.coverNote,
        },
      });
      const bid = await tx.bid.update({
        where: { id: existing.id },
        data: {
          ...data,
          revisionCount: { increment: 1 },
          status: existing.status === "WITHDRAWN" ? "SUBMITTED" : existing.status,
        },
      });
      return { bid, revised: true };
    });

    await notifications.notify(project.homeownerId, result.revised ? "BID_UPDATED" : "BID_RECEIVED", {
      title: result.revised ? "A bid was updated" : "New bid received",
      body: `${profile.companyName} ${result.revised ? "revised their bid to" : "bid"} ${formatINR(v.totalPrice)} on "${project.title}".`,
      href: `/projects/${project.id}`,
    });
    revalidatePath(`/builder/projects/${project.id}`);
    revalidatePath("/builder/bids");
    return { bidId: result.bid.id, revised: result.revised };
  });
}

export async function withdrawBidAction(bidId: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["BUILDER"]);
    const id = idSchema.parse(bidId);
    const bid = await prisma.bid.findUnique({ where: { id }, include: { project: true, builder: true } });
    if (!bid || bid.builder.userId !== user.id) throw new ActionError("Bid not found");
    if (!isBiddingOpen(bid.project)) throw new ActionError("Bidding has closed; contact the homeowner instead");
    if (bid.status !== "SUBMITTED" && bid.status !== "SHORTLISTED") throw new ActionError("This bid can't be withdrawn");
    await prisma.bid.update({ where: { id }, data: { status: "WITHDRAWN" } });
    await notifications.notify(bid.project.homeownerId, "BID_WITHDRAWN", {
      title: "Bid withdrawn",
      body: `${bid.builder.companyName} withdrew their bid on "${bid.project.title}".`,
      href: `/projects/${bid.projectId}`,
    });
    revalidatePath("/builder/bids");
    return undefined;
  });
}

/** Homeowner shortlists, rejects, or un-shortlists (SUBMITTED) a bid. */
export async function decideBidAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const { bidId, decision } = bidDecisionSchema.parse(input);
    const bid = await prisma.bid.findUnique({ where: { id: bidId }, include: { project: true, builder: true } });
    if (!bid || bid.project.homeownerId !== user.id) throw new ActionError("Bid not found");
    if (bid.project.status !== "OPEN" && bid.project.status !== "UNDER_REVIEW") {
      throw new ActionError("This project is no longer accepting decisions");
    }
    if (bid.status === "WITHDRAWN" || bid.status === "AWARDED") throw new ActionError("This bid can't be changed");
    await prisma.bid.update({ where: { id: bidId }, data: { status: decision } });
    if (decision !== "SUBMITTED") {
      await notifications.notify(bid.builder.userId, decision === "SHORTLISTED" ? "BID_SHORTLISTED" : "BID_REJECTED", {
        title: decision === "SHORTLISTED" ? "You've been shortlisted!" : "Bid not selected",
        body:
          decision === "SHORTLISTED"
            ? `The homeowner shortlisted your bid for "${bid.project.title}".`
            : `The homeowner declined your bid for "${bid.project.title}".`,
        href: `/bids/${bidId}`,
      });
    }
    revalidatePath(`/projects/${bid.projectId}`);
    revalidatePath(`/projects/${bid.projectId}/compare`);
    return undefined;
  });
}

/** Awards the project: closes bidding, marks this bid AWARDED and every other live bid REJECTED. */
export async function awardBidAction(bidId: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const id = idSchema.parse(bidId);

    const project = await prisma.$transaction(async (tx) => {
      const bid = await tx.bid.findUnique({ where: { id }, include: { project: true, builder: true } });
      if (!bid || bid.project.homeownerId !== user.id) throw new ActionError("Bid not found");
      if (bid.status !== "SUBMITTED" && bid.status !== "SHORTLISTED") throw new ActionError("This bid can't be awarded");

      const { count } = await tx.project.updateMany({
        where: { id: bid.projectId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
        data: { status: "AWARDED", awardedBidId: bid.id, awardedAt: new Date() },
      });
      if (count === 0) throw new ActionError("This project has already been awarded or closed");

      await tx.bid.update({ where: { id: bid.id }, data: { status: "AWARDED" } });
      const others = await tx.bid.findMany({
        where: { projectId: bid.projectId, id: { not: bid.id }, status: { in: ["SUBMITTED", "SHORTLISTED"] } },
        include: { builder: true },
      });
      await tx.bid.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "REJECTED" } });

      await notifications.notify(
        bid.builder.userId,
        "BID_AWARDED",
        { title: "🎉 You won the project", body: `Your bid for "${bid.project.title}" was awarded. Contact details are now unlocked.`, href: `/bids/${bid.id}` },
        tx,
      );
      await notifications.notify(
        others.map((o) => o.builder.userId),
        "PROJECT_AWARDED",
        { title: "Project awarded", body: `"${bid.project.title}" was awarded to another builder. Thanks for bidding.`, href: `/builder/bids` },
        tx,
      );
      await notifications.notify(
        user.id,
        "PROJECT_AWARDED",
        { title: "Project awarded", body: `You awarded "${bid.project.title}" to ${bid.builder.companyName}.`, href: `/projects/${bid.projectId}` },
        tx,
      );
      return bid.project;
    });

    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/projects/${project.id}/compare`);
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function sendMessageAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER", "BUILDER"]);
    const v = messageSchema.parse(input);
    const access = await getBidForParticipant(v.bidId, user);
    if (!access || (!access.isHomeowner && !access.isBuilder)) throw new ActionError("Conversation not found");
    const { bid } = access;
    if (bid.project.status === "CANCELLED" || bid.status === "WITHDRAWN") {
      throw new ActionError("This conversation is closed");
    }
    const body = contactUnlocked(bid) ? v.body : redactContacts(v.body);
    await prisma.message.create({ data: { projectId: bid.projectId, bidId: bid.id, senderId: user.id, body } });
    const recipient = access.isHomeowner ? bid.builder.userId : bid.project.homeownerId;
    await notifications.notify(recipient, "NEW_MESSAGE", {
      title: `New message from ${access.isHomeowner ? bid.project.homeowner.name : bid.builder.companyName}`,
      body: body.length > 120 ? body.slice(0, 117) + "…" : body,
      href: `/bids/${bid.id}`,
    });
    revalidatePath(`/bids/${bid.id}`);
    return undefined;
  });
}

export async function createReviewAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const v = reviewSchema.parse(input);
    const project = await prisma.project.findUnique({
      where: { id: v.projectId },
      include: { awardedBid: { include: { builder: true } }, review: true },
    });
    if (!project || project.homeownerId !== user.id) throw new ActionError("Project not found");
    if (!project.awardedBid || (project.status !== "AWARDED" && project.status !== "CLOSED")) {
      throw new ActionError("You can review a builder only after awarding the project");
    }
    if (project.review) throw new ActionError("You've already reviewed this builder");
    const builder = project.awardedBid.builder;

    await prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: { projectId: project.id, builderId: builder.id, homeownerId: user.id, rating: v.rating, comment: v.comment || null },
      });
      const agg = await tx.review.aggregate({ where: { builderId: builder.id }, _avg: { rating: true }, _count: true });
      await tx.builderProfile.update({
        where: { id: builder.id },
        data: { avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
      });
      await notifications.notify(
        builder.userId,
        "REVIEW_RECEIVED",
        { title: "New review", body: `You received a ${v.rating}★ review for "${project.title}".`, href: `/builders/${builder.id}` },
        tx,
      );
    });
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/builders/${builder.id}`);
    return undefined;
  });
}
