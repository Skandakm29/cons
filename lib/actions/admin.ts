"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActionUser } from "@/lib/auth/session";
import { notifications } from "@/lib/services/notifications";
import { defaultBidDeadline } from "@/lib/services/projects";
import { moderateBidSchema, moderateProjectSchema, rateSchema } from "@/lib/validation/admin";
import { verifyBuilderSchema } from "@/lib/validation/builder";
import { ActionError, runAction, type ActionResult } from "./result";

export async function verifyBuilderAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireActionUser(["ADMIN"]);
    const v = verifyBuilderSchema.parse(input);
    const profile = await prisma.builderProfile.update({
      where: { id: v.builderId },
      data: {
        verificationStatus: v.decision,
        verificationNote: v.decision === "REJECTED" ? v.reason : null,
        verifiedAt: v.decision === "VERIFIED" ? new Date() : null,
      },
    });
    await notifications.notify(
      profile.userId,
      v.decision === "VERIFIED" ? "BUILDER_VERIFIED" : "BUILDER_REJECTED",
      v.decision === "VERIFIED"
        ? { title: "You're verified ✅", body: "You can now bid on open projects.", href: "/builder/projects" }
        : { title: "Verification needs attention", body: `Reason: ${v.reason}. Update your profile to resubmit.`, href: "/builder/onboarding" },
    );
    revalidatePath("/admin/builders");
    return undefined;
  });
}

export async function updateRateAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireActionUser(["ADMIN"]);
    const v = rateSchema.parse(input);
    await prisma.estimatorRate.upsert({
      where: { city_package: { city: v.city, package: v.package } },
      create: v,
      update: { ratePerSqftLow: v.ratePerSqftLow, ratePerSqftHigh: v.ratePerSqftHigh, breakdownPercents: v.breakdownPercents },
    });
    revalidatePath("/admin/rates");
    return undefined;
  });
}

export async function moderateProjectAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireActionUser(["ADMIN"]);
    const v = moderateProjectSchema.parse(input);
    const project = await prisma.project.findUnique({
      where: { id: v.projectId },
      include: { bids: { where: { status: { in: ["SUBMITTED", "SHORTLISTED"] } }, include: { builder: true } } },
    });
    if (!project) throw new ActionError("Project not found");
    if (v.action === "CANCEL") {
      if (project.status === "AWARDED" || project.status === "CLOSED" || project.status === "CANCELLED") {
        throw new ActionError(`Can't cancel a ${project.status.toLowerCase()} project`);
      }
      await prisma.project.update({ where: { id: project.id }, data: { status: "CANCELLED", moderationNote: v.note } });
      await notifications.notify(
        [project.homeownerId, ...project.bids.map((b) => b.builder.userId)],
        "PROJECT_CANCELLED",
        { title: "Project removed by moderator", body: `"${project.title}" was cancelled: ${v.note}` },
      );
    } else {
      if (project.status !== "CANCELLED" && project.status !== "UNDER_REVIEW") {
        throw new ActionError("Only cancelled or under-review projects can be reopened");
      }
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "OPEN", bidDeadline: defaultBidDeadline(), moderationNote: v.note, publishedAt: project.publishedAt ?? new Date() },
      });
      await notifications.notify(project.homeownerId, "PROJECT_PUBLISHED", {
        title: "Project reopened",
        body: `"${project.title}" is open for bids again: ${v.note}`,
        href: `/projects/${project.id}`,
      });
    }
    revalidatePath("/admin/projects");
    return undefined;
  });
}

/** Removes an abusive or invalid bid (marks it REJECTED with a note to the builder). */
export async function moderateBidAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireActionUser(["ADMIN"]);
    const v = moderateBidSchema.parse(input);
    const bid = await prisma.bid.findUnique({ where: { id: v.bidId }, include: { project: true, builder: true } });
    if (!bid) throw new ActionError("Bid not found");
    if (bid.status === "AWARDED") throw new ActionError("Awarded bids can't be removed here");
    await prisma.bid.update({ where: { id: bid.id }, data: { status: "REJECTED" } });
    await notifications.notify(bid.builder.userId, "BID_REJECTED", {
      title: "Bid removed by moderator",
      body: `Your bid on "${bid.project.title}" was removed: ${v.note}`,
      href: "/builder/bids",
    });
    revalidatePath("/admin/projects");
    return undefined;
  });
}
