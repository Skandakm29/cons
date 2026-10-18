import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Loads a bid if `user` may see it: the project's homeowner, the bidding builder, or an admin.
 * Builders never get other builders' bids (sealed bidding).
 */
export async function getBidForParticipant(bidId: string, user: Pick<User, "id" | "role">) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      project: { include: { homeowner: true } },
      builder: { include: { user: true } },
    },
  });
  if (!bid) return null;
  const isHomeowner = bid.project.homeownerId === user.id;
  const isBuilder = bid.builder.userId === user.id;
  if (!isHomeowner && !isBuilder && user.role !== "ADMIN") return null;
  return { bid, isHomeowner, isBuilder };
}

/** Contact details are revealed only once this bid has won the project. */
export function contactUnlocked(bid: { status: string }): boolean {
  return bid.status === "AWARDED";
}

const PHONE_LIKE = /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}/g;

/** Hides phone numbers in chat until the project is awarded to this bid. */
export function redactContacts(body: string): string {
  return body.replace(PHONE_LIKE, "[number hidden until award]");
}
