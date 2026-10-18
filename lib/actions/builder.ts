"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActionUser } from "@/lib/auth/session";
import { idSchema } from "@/lib/validation/common";
import { builderProfileSchema, portfolioItemSchema } from "@/lib/validation/builder";
import { ActionError, runAction, type ActionResult } from "./result";

export async function saveBuilderProfileAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser(["BUILDER"]);
    const v = builderProfileSchema.parse(input);
    const data = {
      companyName: v.companyName,
      yearsOfExperience: v.yearsOfExperience,
      citiesServed: v.citiesServed,
      gstNumber: v.gstNumber || null,
      licenseDocUrl: v.licenseDocUrl || null,
      about: v.about || null,
    };
    const existing = await prisma.builderProfile.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.builderProfile.create({ data: { ...data, userId: user.id } });
    } else {
      // A rejected builder who updates their profile goes back into the verification queue.
      await prisma.builderProfile.update({
        where: { userId: user.id },
        data: {
          ...data,
          ...(existing.verificationStatus === "REJECTED" ? { verificationStatus: "PENDING", verificationNote: null } : {}),
        },
      });
    }
    revalidatePath("/builder/onboarding");
    return undefined;
  });
}

async function requireOwnProfile() {
  const user = await requireActionUser(["BUILDER"]);
  const profile = await prisma.builderProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ActionError("Save your company profile first");
  return profile;
}

export async function addPortfolioItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const profile = await requireOwnProfile();
    const v = portfolioItemSchema.parse(input);
    const item = await prisma.portfolioItem.create({
      data: { ...v, description: v.description || null, builderId: profile.id },
    });
    revalidatePath("/builder/onboarding");
    revalidatePath(`/builders/${profile.id}`);
    return { id: item.id };
  });
}

export async function deletePortfolioItemAction(itemId: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const profile = await requireOwnProfile();
    const id = idSchema.parse(itemId);
    const { count } = await prisma.portfolioItem.deleteMany({ where: { id, builderId: profile.id } });
    if (count === 0) throw new ActionError("Portfolio item not found");
    revalidatePath("/builder/onboarding");
    return undefined;
  });
}
