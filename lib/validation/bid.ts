import { z } from "zod";
import { assetUrl, breakdownAmountsSchema, httpUrl, idSchema, intRange, paymentMilestonesSchema, rupees } from "./common";

export const DEMO_TYPES = ["PORTFOLIO", "DESIGN_LINK", "VIDEO", "IMAGES"] as const;

export const MATERIAL_FIELDS = [
  ["cement", "Cement brand", "e.g. UltraTech / ACC"],
  ["steel", "Steel (TMT) brand", "e.g. JSW Neosteel Fe550D"],
  ["blocks", "Bricks / blocks", "e.g. Solid concrete blocks 6\""],
  ["tiles", "Flooring tiles", "e.g. Kajaria vitrified 2x2"],
  ["paint", "Paint", "e.g. Asian Paints Apcolite"],
  ["electrical", "Wiring & switches", "e.g. Finolex wires, Legrand switches"],
  ["plumbing", "Plumbing pipes", "e.g. Ashirvad CPVC"],
  ["sanitary", "Sanitaryware & CP fittings", "e.g. Hindware / Jaquar"],
  ["doors", "Doors & windows", "e.g. Teak main door, UPVC windows"],
] as const;
export type MaterialKey = (typeof MATERIAL_FIELDS)[number][0];

export const materialsSpecSchema = z.object(
  Object.fromEntries(
    MATERIAL_FIELDS.map(([k, label]) => [k, z.string().trim().min(2, `Specify ${label.toLowerCase()}`).max(120)]),
  ) as Record<MaterialKey, z.ZodString>,
);
export type MaterialsSpec = z.infer<typeof materialsSpecSchema>;

export const bidSchema = z
  .object({
    projectId: idSchema,
    totalPrice: rupees("Total price").min(100_000, "Total price looks too low"),
    breakdown: breakdownAmountsSchema,
    timelineWeeks: intRange("Timeline", 4, 260),
    materialsSpec: materialsSpecSchema,
    warrantyYears: intRange("Warranty", 0, 30),
    paymentMilestones: paymentMilestonesSchema,
    demoType: z.enum(DEMO_TYPES),
    demoUrls: z.array(z.string()).max(12),
    demoPortfolioItemIds: z.array(idSchema).max(12),
    coverNote: z.string().trim().min(20, "Write at least a couple of sentences").max(3000),
  })
  .superRefine((v, ctx) => {
    const sum = Object.values(v.breakdown).reduce((s, n) => s + n, 0);
    if (sum !== v.totalPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["breakdown"],
        message: `Breakdown adds up to ₹${sum.toLocaleString("en-IN")} but total is ₹${v.totalPrice.toLocaleString("en-IN")}`,
      });
    }
    const urlSchema = v.demoType === "IMAGES" ? assetUrl : httpUrl;
    v.demoUrls.forEach((u, i) => {
      if (!urlSchema.safeParse(u).success) {
        ctx.addIssue({ code: "custom", path: ["demoUrls", i], message: "Enter a valid link" });
      }
    });
    if (v.demoType === "PORTFOLIO" && v.demoPortfolioItemIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["demoPortfolioItemIds"], message: "Pick at least one portfolio project" });
    }
    if (v.demoType !== "PORTFOLIO" && v.demoUrls.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["demoUrls"],
        message: v.demoType === "IMAGES" ? "Upload at least one image" : "Add at least one link",
      });
    }
  });
export type BidInput = z.infer<typeof bidSchema>;
export type BidFormValues = z.input<typeof bidSchema>;

export const bidDecisionSchema = z.object({ bidId: idSchema, decision: z.enum(["SHORTLISTED", "REJECTED", "SUBMITTED"]) });
export const messageSchema = z.object({ bidId: idSchema, body: z.string().trim().min(1, "Type a message").max(2000) });
export const reviewSchema = z.object({
  projectId: idSchema,
  rating: intRange("Rating", 1, 5),
  comment: z.string().trim().max(1000).optional(),
});
