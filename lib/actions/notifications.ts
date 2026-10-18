"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActionUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "./result";

export async function markAllNotificationsReadAction(): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireActionUser();
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    revalidatePath("/", "layout");
    return undefined;
  });
}
