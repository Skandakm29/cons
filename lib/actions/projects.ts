"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActionUser } from "@/lib/auth/session";
import { EstimatorError } from "@/lib/estimator";
import { createEstimateForProject } from "@/lib/services/estimates";
import { notifications } from "@/lib/services/notifications";
import { defaultBidDeadline } from "@/lib/services/projects";
import { idSchema } from "@/lib/validation/common";
import { projectSchema } from "@/lib/validation/project";
import { ActionError, runAction, type ActionResult } from "./result";

async function notifyBuildersOfNewProject(project: { id: string; title: string; city: string }) {
  const builders = await prisma.builderProfile.findMany({
    where: { verificationStatus: "VERIFIED", citiesServed: { has: project.city } },
    select: { userId: true },
  });
  await notifications.notify(
    builders.map((b) => b.userId),
    "PROJECT_PUBLISHED",
    { title: "New project in " + project.city, body: `"${project.title}" is open for bids.`, href: `/builder/projects/${project.id}` },
  );
}

export async function createProjectAction(input: unknown): Promise<ActionResult<{ projectId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const v = projectSchema.parse(input);
    const now = new Date();
    try {
      const project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({
          data: {
            homeownerId: user.id,
            title: v.title,
            city: v.city,
            locality: v.locality,
            plotLengthFt: v.plotLengthFt,
            plotWidthFt: v.plotWidthFt,
            plotAreaSqft: v.plotLengthFt * v.plotWidthFt,
            builtUpAreaSqft: v.builtUpAreaSqft,
            floors: v.floors,
            bedrooms: v.bedrooms,
            bathrooms: v.bathrooms,
            parking: v.parking,
            facing: v.facing,
            vastuRequired: v.vastuRequired,
            preferredPackage: v.preferredPackage,
            extraBasement: v.extras.basement,
            extraLift: v.extras.lift,
            extraCompoundWall: v.extras.compoundWall,
            extraSump: v.extras.sump,
            extraSolar: v.extras.solar,
            budgetMin: v.budgetMin,
            budgetMax: v.budgetMax,
            startTimeline: v.startTimeline,
            notes: v.notes || null,
            status: v.publish ? "OPEN" : "DRAFT",
            publishedAt: v.publish ? now : null,
            bidDeadline: v.publish ? defaultBidDeadline(now) : null,
          },
        });
        await createEstimateForProject(p, tx);
        return p;
      });
      if (v.publish) {
        await notifications.notify(user.id, "PROJECT_PUBLISHED", {
          title: "Project published",
          body: `"${project.title}" is live. Verified builders can bid until the deadline.`,
          href: `/projects/${project.id}`,
        });
        await notifyBuildersOfNewProject(project);
      }
      revalidatePath("/dashboard");
      return { projectId: project.id };
    } catch (e) {
      if (e instanceof EstimatorError) throw new ActionError(e.message);
      throw e;
    }
  });
}

export async function publishProjectAction(projectId: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const id = idSchema.parse(projectId);
    const now = new Date();
    const { count } = await prisma.project.updateMany({
      where: { id, homeownerId: user.id, status: "DRAFT" },
      data: { status: "OPEN", publishedAt: now, bidDeadline: defaultBidDeadline(now) },
    });
    if (count === 0) throw new ActionError("Only your draft projects can be published");
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    // Re-run the estimate so it reflects the latest admin rates at publish time.
    await createEstimateForProject(project);
    await notifications.notify(user.id, "PROJECT_PUBLISHED", {
      title: "Project published",
      body: `"${project.title}" is live for bids.`,
      href: `/projects/${id}`,
    });
    await notifyBuildersOfNewProject(project);
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function cancelProjectAction(projectId: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["HOMEOWNER"]);
    const id = idSchema.parse(projectId);
    const project = await prisma.$transaction(async (tx) => {
      const { count } = await tx.project.updateMany({
        where: { id, homeownerId: user.id, status: { in: ["DRAFT", "OPEN", "UNDER_REVIEW"] } },
        data: { status: "CANCELLED" },
      });
      if (count === 0) throw new ActionError("This project can't be cancelled");
      return tx.project.findUniqueOrThrow({
        where: { id },
        include: { bids: { where: { status: { in: ["SUBMITTED", "SHORTLISTED"] } }, include: { builder: true } } },
      });
    });
    await notifications.notify(
      project.bids.map((b) => b.builder.userId),
      "PROJECT_CANCELLED",
      { title: "Project cancelled", body: `The homeowner cancelled "${project.title}".`, href: `/builder/bids` },
    );
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");
    return undefined;
  });
}
