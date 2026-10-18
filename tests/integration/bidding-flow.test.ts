import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

// Only the session is mocked; actions, validation and Prisma run for real.
const session = vi.hoisted(() => ({ current: null as User | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", async () => {
  const { ActionError } = await import("@/lib/actions/result");
  return {
    getCurrentUser: async () => session.current,
    requireActionUser: async (roles?: string[]) => {
      const u = session.current;
      if (!u) throw new ActionError("Please log in again");
      if (roles && !roles.includes(u.role)) throw new ActionError("You don't have permission to do that");
      return u;
    },
  };
});

import { prisma } from "@/lib/db";
import { createProjectAction } from "@/lib/actions/projects";
import { awardBidAction, createReviewAction, decideBidAction, sendMessageAction, submitBidAction } from "@/lib/actions/bids";
import { distributeByPercents } from "@/lib/estimator";
import { getLatestEstimate } from "@/lib/services/estimates";
import { closeExpiredBidding } from "@/lib/services/projects";
import type { BidInput } from "@/lib/validation/bid";
import type { ProjectInput } from "@/lib/validation/project";
import type { BreakdownPercents } from "@/lib/estimator/types";

const TAG = `it${Date.now().toString().slice(-6)}`;
const phone = (n: number) => `6${TAG.slice(2)}${n.toString().padStart(3, "0")}`;
const as = (u: User) => (session.current = u);

let homeowner: User, otherHomeowner: User, builderA: User, builderB: User, pendingBuilder: User;
let projectId: string;
let percents: BreakdownPercents;
let bidA: string, bidB: string;

const projectInput: ProjectInput = {
  title: `${TAG} test home`, city: "Bengaluru", locality: "Test Nagar", plotLengthFt: 30, plotWidthFt: 40, facing: "EAST",
  builtUpAreaSqft: 2000, floors: 2, bedrooms: 3, bathrooms: 3, parking: true, vastuRequired: false, preferredPackage: "STANDARD",
  extras: { basement: false, lift: false, compoundWall: true, sump: true, solar: false },
  budgetMin: 4_000_000, budgetMax: 5_000_000, startTimeline: "1–3 months", notes: "", publish: true,
};
const materials = { cement: "UltraTech", steel: "JSW", blocks: "Solid blocks", tiles: "Kajaria", paint: "Asian", electrical: "Finolex", plumbing: "Ashirvad", sanitary: "Jaquar", doors: "Teak" };
const bid = (total: number, over: Partial<BidInput> = {}): BidInput => ({
  projectId, totalPrice: total, breakdown: distributeByPercents(total, percents), timelineWeeks: 30, materialsSpec: materials,
  warrantyYears: 10, paymentMilestones: [{ name: "Booking", percent: 20 }, { name: "Structure", percent: 50 }, { name: "Handover", percent: 30 }],
  demoType: "DESIGN_LINK", demoUrls: ["https://example.com/design"], demoPortfolioItemIds: [],
  coverNote: "We have built many similar homes nearby with on-time delivery.", ...over,
});

beforeAll(async () => {
  const rates = await prisma.estimatorRate.count({ where: { city: "Bengaluru" } });
  if (rates < 4) throw new Error("Run `npm run seed` first — integration tests need Bengaluru estimator rates");
  const mk = (n: number, role: User["role"]) => prisma.user.create({ data: { name: `${TAG} user ${n}`, phone: phone(n), role } });
  [homeowner, otherHomeowner, builderA, builderB, pendingBuilder] = await Promise.all([
    mk(1, "HOMEOWNER"), mk(2, "HOMEOWNER"), mk(3, "BUILDER"), mk(4, "BUILDER"), mk(5, "BUILDER"),
  ]);
  for (const [u, status] of [[builderA, "VERIFIED"], [builderB, "VERIFIED"], [pendingBuilder, "PENDING"]] as const) {
    await prisma.builderProfile.create({
      data: { userId: u.id, companyName: `${TAG} ${u.name}`, yearsOfExperience: 5, citiesServed: ["Bengaluru"], verificationStatus: status },
    });
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("project posting", () => {
  it("rejects non-homeowners", async () => {
    as(builderA);
    const res = await createProjectAction(projectInput);
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/permission/) });
  });

  it("rejects built-up area larger than plot × floors", async () => {
    as(homeowner);
    const res = await createProjectAction({ ...projectInput, builtUpAreaSqft: 5000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors?.builtUpAreaSqft?.[0]).toMatch(/can't exceed/);
  });

  it("publishes a project with an estimate, deadline and builder notifications", async () => {
    as(homeowner);
    const res = await createProjectAction(projectInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    projectId = res.data.projectId;
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.status).toBe("OPEN");
    expect(project.plotAreaSqft).toBe(1200);
    const days = (project.bidDeadline!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    const est = await getLatestEstimate(projectId);
    expect(est!.totalLow).toBeLessThan(est!.totalHigh);
    expect(est!.breakdown.extras.map((e) => e.key)).toEqual(["compoundWall", "sump"]);
    percents = Object.fromEntries(est!.breakdown.categories.map((c) => [c.category, c.percent])) as BreakdownPercents;
    const notified = await prisma.notification.count({ where: { userId: builderA.id, type: "PROJECT_PUBLISHED" } });
    expect(notified).toBe(1);
    // Pending builders are not notified of new projects.
    expect(await prisma.notification.count({ where: { userId: pendingBuilder.id } })).toBe(0);
  });
});

describe("bidding", () => {
  it("blocks unverified builders", async () => {
    as(pendingBuilder);
    expect(await submitBidAction(bid(4_500_000))).toMatchObject({ ok: false, error: "Only verified builders can bid" });
  });

  it("requires milestones to total exactly 100%", async () => {
    as(builderA);
    const res = await submitBidAction(bid(4_500_000, { paymentMilestones: [{ name: "Booking", percent: 20 }, { name: "Rest", percent: 70 }] }));
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/total exactly 100/) });
  });

  it("requires the breakdown to add up to the total", async () => {
    as(builderA);
    const res = await submitBidAction({ ...bid(4_500_000), totalPrice: 4_600_000 });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/Breakdown adds up/) });
  });

  it("requires valid demo links", async () => {
    as(builderA);
    const res = await submitBidAction(bid(4_500_000, { demoUrls: ["javascript:alert(1)"] }));
    expect(res.ok).toBe(false);
  });

  it("accepts a valid bid and notifies the homeowner", async () => {
    as(builderA);
    const res = await submitBidAction(bid(4_500_000));
    expect(res).toMatchObject({ ok: true, data: { revised: false } });
    if (res.ok) bidA = res.data.bidId;
    expect(await prisma.notification.count({ where: { userId: homeowner.id, type: "BID_RECEIVED" } })).toBe(1);
  });

  it("keeps one bid per builder and stores a revision on edit", async () => {
    as(builderA);
    const res = await submitBidAction(bid(4_300_000));
    expect(res).toMatchObject({ ok: true, data: { bidId: bidA, revised: true } });
    const bids = await prisma.bid.findMany({ where: { projectId, builder: { userId: builderA.id } }, include: { revisions: true } });
    expect(bids).toHaveLength(1);
    expect(bids[0].totalPrice).toBe(4_300_000);
    expect(bids[0].revisions.map((r) => [r.revisionNumber, r.totalPrice])).toEqual([[1, 4_500_000]]);
  });

  it("lets a second builder bid", async () => {
    as(builderB);
    const res = await submitBidAction(bid(4_800_000));
    expect(res.ok).toBe(true);
    if (res.ok) bidB = res.data.bidId;
  });
});

describe("homeowner decisions", () => {
  it("prevents other homeowners from acting on the bid", async () => {
    as(otherHomeowner);
    expect(await awardBidAction(bidA)).toMatchObject({ ok: false, error: "Bid not found" });
    expect(await decideBidAction({ bidId: bidA, decision: "REJECTED" })).toMatchObject({ ok: false });
  });

  it("shortlists a bid and notifies the builder", async () => {
    as(homeowner);
    expect((await decideBidAction({ bidId: bidB, decision: "SHORTLISTED" })).ok).toBe(true);
    expect((await prisma.bid.findUniqueOrThrow({ where: { id: bidB } })).status).toBe("SHORTLISTED");
    expect(await prisma.notification.count({ where: { userId: builderB.id, type: "BID_SHORTLISTED" } })).toBe(1);
  });

  it("hides phone numbers in chat before award", async () => {
    as(homeowner);
    expect((await sendMessageAction({ bidId: bidA, body: "Call me on 98450 12345 please" })).ok).toBe(true);
    const msg = await prisma.message.findFirstOrThrow({ where: { bidId: bidA }, orderBy: { createdAt: "desc" } });
    expect(msg.body).not.toMatch(/98450/);
    expect(msg.body).toMatch(/hidden until award/);
  });

  it("stops a builder from messaging on a bid that isn't theirs", async () => {
    as(builderB);
    expect(await sendMessageAction({ bidId: bidA, body: "hello" })).toMatchObject({ ok: false });
  });

  it("awards: closes bidding, rejects other bids and notifies everyone", async () => {
    as(homeowner);
    expect((await awardBidAction(bidA)).ok).toBe(true);
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project).toMatchObject({ status: "AWARDED", awardedBidId: bidA });
    const statuses = await prisma.bid.findMany({ where: { projectId }, select: { id: true, status: true } });
    expect(Object.fromEntries(statuses.map((s) => [s.id, s.status]))).toEqual({ [bidA]: "AWARDED", [bidB]: "REJECTED" });
    expect(await prisma.notification.count({ where: { userId: builderA.id, type: "BID_AWARDED" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: builderB.id, type: "PROJECT_AWARDED" } })).toBe(1);
  });

  it("rejects further bids and a second award", async () => {
    as(builderB);
    expect(await submitBidAction(bid(4_000_000))).toMatchObject({ ok: false, error: expect.stringMatching(/closed|no longer/) });
    as(homeowner);
    expect((await awardBidAction(bidB)).ok).toBe(false);
  });

  it("allows phone numbers in chat after award", async () => {
    as(builderA);
    await sendMessageAction({ bidId: bidA, body: "Reach me at 9845012345" });
    const msg = await prisma.message.findFirstOrThrow({ where: { bidId: bidA }, orderBy: { createdAt: "desc" } });
    expect(msg.body).toContain("9845012345");
  });

  it("accepts one review after award and updates the rating", async () => {
    as(homeowner);
    expect((await createReviewAction({ projectId, rating: 4, comment: "Good" })).ok).toBe(true);
    const profile = await prisma.builderProfile.findUniqueOrThrow({ where: { userId: builderA.id } });
    expect(profile).toMatchObject({ avgRating: 4, ratingCount: 1 });
    expect(await createReviewAction({ projectId, rating: 5 })).toMatchObject({ ok: false });
  });
});

describe("deadline", () => {
  it("moves expired OPEN projects to UNDER_REVIEW", async () => {
    as(homeowner);
    const res = await createProjectAction({ ...projectInput, title: `${TAG} expiring` });
    if (!res.ok) throw new Error(res.error);
    await prisma.project.update({ where: { id: res.data.projectId }, data: { bidDeadline: new Date(Date.now() - 1000) } });
    as(builderA);
    expect(await submitBidAction({ ...bid(4_500_000), projectId: res.data.projectId })).toMatchObject({ ok: false, error: expect.stringMatching(/closed/) });
    await closeExpiredBidding();
    expect((await prisma.project.findUniqueOrThrow({ where: { id: res.data.projectId } })).status).toBe("UNDER_REVIEW");
    expect(await prisma.notification.count({ where: { userId: homeowner.id, type: "BIDDING_CLOSED" } })).toBe(1);
  });
});
