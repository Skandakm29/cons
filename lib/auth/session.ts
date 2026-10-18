import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "./options";
import { ActionError } from "@/lib/actions/result";

/** The signed-in user, re-read from the DB so role and existence are authoritative. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export const ROLE_HOME: Record<Role, string> = {
  HOMEOWNER: "/dashboard",
  BUILDER: "/builder/projects",
  ADMIN: "/admin/builders",
};

/** For server components: redirects to login or the user's home if not permitted. */
export async function requirePageUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** For server actions / route handlers: throws if not permitted. */
export async function requireActionUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("Please log in again");
  if (roles && !roles.includes(user.role)) throw new ActionError("You don't have permission to do that");
  return user;
}
