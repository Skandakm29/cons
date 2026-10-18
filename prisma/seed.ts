/**
 * Demo seed: 1 admin, 3 homeowners, 5 builders (4 verified, 1 pending), portfolios,
 * 5 projects across every main status, and 9 bids with chats, a review and notifications.
 * Re-running wipes and recreates all data.
 */
import { PrismaClient, type BidStatus, type DemoType, type Package, type Prisma } from "@prisma/client";
import { calculateEstimate, defaultPaymentMilestones, distributeByPercents, type BreakdownPercents, type PackageRate } from "../lib/estimator";
import { estimateToCreateData, projectToEstimatorInput } from "../lib/services/estimates";
import { toJson } from "../lib/json";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

// ---------------------------------------------------------------------------
// Estimator rates
// TODO: replace with real market rates. These are PLACEHOLDER values for demo only.
// ---------------------------------------------------------------------------
const STANDARD_SPLIT: BreakdownPercents = {
  foundation: 12, structure: 22, masonry: 10, plastering: 6, waterproofing: 3, plumbing: 7,
  electrical: 7, flooring: 11, painting: 6, doorsWindows: 9, fixtures: 4, miscellaneous: 3,
};
const FINISH_HEAVY_SPLIT: BreakdownPercents = {
  foundation: 11, structure: 19, masonry: 8, plastering: 6, waterproofing: 3, plumbing: 7,
  electrical: 7, flooring: 13, painting: 7, doorsWindows: 10, fixtures: 6, miscellaneous: 3,
};
const PLACEHOLDER_RATES: Record<string, Record<Package, [number, number]>> = {
  // TODO: replace with real market rates (₹ per sqft of built-up area).
  Bengaluru: { BASIC: [1750, 1950], STANDARD: [2050, 2300], PREMIUM: [2400, 2750], LUXURY: [2950, 3600] },
  // TODO: replace with real market rates.
  Mysuru: { BASIC: [1600, 1800], STANDARD: [1900, 2150], PREMIUM: [2250, 2550], LUXURY: [2750, 3300] },
};
const splitFor = (p: Package) => (p === "PREMIUM" || p === "LUXURY" ? FINISH_HEAVY_SPLIT : STANDARD_SPLIT);

const MATERIALS = {
  standard: {
    cement: "UltraTech / ACC OPC 53", steel: "JSW Neosteel Fe550D", blocks: "6\" solid concrete blocks",
    tiles: "Kajaria vitrified 2x2", paint: "Asian Paints Tractor Emulsion", electrical: "Finolex wires, Anchor Roma switches",
    plumbing: "Ashirvad CPVC / Supreme PVC", sanitary: "Hindware, Jaquar Continental CP", doors: "Sal wood frames, flush doors, aluminium windows",
  },
  premium: {
    cement: "UltraTech Super", steel: "Tata Tiscon 550SD", blocks: "Wienerberger Porotherm clay blocks",
    tiles: "Somany GVT 4x2, granite staircase", paint: "Asian Paints Royale", electrical: "Polycab FRLS, Legrand Myrius",
    plumbing: "Astral CPVC Pro", sanitary: "Kohler / Jaquar Florentine", doors: "Teak main door, UPVC sliding windows",
  },
  budget: {
    cement: "Dalmia / Ramco PPC", steel: "Kamadhenu Fe500", blocks: "Red clay bricks",
    tiles: "Ceramic 2x2 (local brand)", paint: "Asian Paints Tractor Emulsion", electrical: "Anchor wires & switches",
    plumbing: "Supreme PVC", sanitary: "Parryware", doors: "Steel frames, flush doors, aluminium windows",
  },
};

async function main() {
  console.log("Clearing existing data…");
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.review.deleteMany();
  await prisma.project.updateMany({ data: { awardedBidId: null } });
  await prisma.bidRevision.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.project.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.builderProfile.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();
  await prisma.estimatorRate.deleteMany();

  console.log("Seeding estimator rates (placeholders)…");
  for (const [city, pkgs] of Object.entries(PLACEHOLDER_RATES)) {
    for (const [pkg, [low, high]] of Object.entries(pkgs) as [Package, [number, number]][]) {
      await prisma.estimatorRate.create({
        data: { city, package: pkg, ratePerSqftLow: low, ratePerSqftHigh: high, breakdownPercents: splitFor(pkg) },
      });
    }
  }
  const ratesFor = (city: string): PackageRate[] =>
    (Object.entries(PLACEHOLDER_RATES[city]) as [Package, [number, number]][]).map(([p, [l, h]]) => ({
      package: p, ratePerSqftLow: l, ratePerSqftHigh: h, breakdownPercents: splitFor(p),
    }));

  console.log("Seeding users…");
  await prisma.user.create({ data: { name: "Asha (Admin)", phone: "9000000000", role: "ADMIN", email: "admin@buildbid.test" } });
  const [priya, rahul, meera] = await Promise.all([
    prisma.user.create({ data: { name: "Priya Sharma", phone: "9000000001", role: "HOMEOWNER" } }),
    prisma.user.create({ data: { name: "Rahul Gowda", phone: "9000000002", role: "HOMEOWNER" } }),
    prisma.user.create({ data: { name: "Meera Iyer", phone: "9000000003", role: "HOMEOWNER" } }),
  ]);

  const builderSeeds = [
    { phone: "9100000001", name: "Karthik Rao", company: "Namma Mane Constructions", years: 14, cities: ["Bengaluru"], status: "VERIFIED", rating: 4.8, completed: 62, gst: "29ABCDE1234F1Z5", about: "Turnkey residential builder focused on east Bengaluru. In-house structural engineer and site supervisors." },
    { phone: "9100000002", name: "Sneha Kulkarni", company: "Sthapathi Builders", years: 9, cities: ["Bengaluru", "Mysuru"], status: "VERIFIED", rating: 4.5, completed: 38, gst: "29FGHIJ5678K1Z2", about: "Vastu-compliant independent homes and duplexes across Bengaluru and Mysuru." },
    { phone: "9100000003", name: "Imran Khan", company: "UrbanNest Homes", years: 6, cities: ["Bengaluru"], status: "VERIFIED", rating: 4.1, completed: 21, gst: "29KLMNO9012P1Z8", about: "Fast-track construction with a lean team. Specialists in G+2 rental buildings." },
    { phone: "9100000004", name: "Lakshmi Narayan", company: "Shilpa Premium Villas", years: 18, cities: ["Bengaluru"], status: "VERIFIED", rating: 4.9, completed: 85, gst: "29PQRST3456U1Z1", about: "Premium and luxury villas with Italian marble, home automation and landscape design." },
    { phone: "9100000005", name: "Vikram Shetty", company: "Coastal Build Co.", years: 3, cities: ["Bengaluru"], status: "PENDING", rating: 0, completed: 4, gst: null, about: "New firm, previously site engineers at a large developer." },
  ] as const;

  type SeededBuilder = {
    user: Prisma.UserGetPayload<object>;
    profile: Prisma.BuilderProfileGetPayload<object>;
    portfolio: Prisma.PortfolioItemGetPayload<object>[];
  };
  const builders: SeededBuilder[] = [];
  for (const [i, b] of builderSeeds.entries()) {
    const user = await prisma.user.create({ data: { name: b.name, phone: b.phone, role: "BUILDER" } });
    const profile = await prisma.builderProfile.create({
      data: {
        userId: user.id,
        companyName: b.company,
        yearsOfExperience: b.years,
        citiesServed: [...b.cities],
        gstNumber: b.gst,
        licenseDocUrl: null,
        about: b.about,
        verificationStatus: b.status,
        verifiedAt: b.status === "VERIFIED" ? daysFromNow(-120) : null,
        avgRating: b.rating,
        ratingCount: b.status === "VERIFIED" ? 6 + i * 3 : 0,
        completedProjectsCount: b.completed,
      },
    });
    const portfolio = [];
    for (let k = 0; k < 2; k++) {
      const n = ((i * 2 + k) % 6) + 1;
      portfolio.push(
        await prisma.portfolioItem.create({
          data: {
            builderId: profile.id,
            title: ["G+1 home", "Duplex villa", "G+2 rental", "Courtyard house", "Corner-plot home", "Compact G+1"][n - 1] + ` in ${["Whitefield", "JP Nagar", "HSR Layout", "Yelahanka", "Banashankari", "Hebbal"][(i + k) % 6]}`,
            city: "Bengaluru",
            areaSqft: 1800 + n * 350,
            imageUrls: [`/seed/house-${n}.svg`, `/seed/house-${(n % 6) + 1}.svg`],
            description: "Delivered on schedule with milestone-based payments and weekly site photo updates.",
            completedYear: 2019 + ((i + k) % 6),
          },
        }),
      );
    }
    builders.push({ user, profile, portfolio });
  }
  const [namma, sthapathi, urbannest, shilpa] = builders;

  console.log("Seeding projects, estimates and bids…");
  type ProjectSeed = Omit<Prisma.ProjectUncheckedCreateInput, "plotAreaSqft">;
  async function createProject(data: ProjectSeed) {
    const project = await prisma.project.create({
      data: { ...data, plotAreaSqft: data.plotLengthFt * data.plotWidthFt },
    });
    const est = calculateEstimate(projectToEstimatorInput(project), ratesFor(project.city));
    await prisma.estimate.create({ data: { projectId: project.id, ...estimateToCreateData(est) } });
    return { project, est };
  }

  async function createBid(opts: {
    projectId: string;
    builder: (typeof builders)[number];
    totalPrice: number;
    pkg: Package;
    floors: number;
    timelineWeeks: number;
    warrantyYears: number;
    materials: keyof typeof MATERIALS;
    demoType: DemoType;
    demoUrls?: string[];
    status?: BidStatus;
    coverNote: string;
    revisedFrom?: number;
  }) {
    const percents = splitFor(opts.pkg);
    const bid = await prisma.bid.create({
      data: {
        projectId: opts.projectId,
        builderId: opts.builder.profile.id,
        totalPrice: opts.totalPrice,
        breakdown: distributeByPercents(opts.totalPrice, percents),
        timelineWeeks: opts.timelineWeeks,
        materialsSpec: MATERIALS[opts.materials],
        warrantyYears: opts.warrantyYears,
        paymentMilestones: toJson(defaultPaymentMilestones(opts.floors)),
        demoType: opts.demoType,
        demoUrls: opts.demoType === "PORTFOLIO" ? [] : (opts.demoUrls ?? []),
        demoPortfolioItemIds: opts.demoType === "PORTFOLIO" ? opts.builder.portfolio.map((p) => p.id) : [],
        coverNote: opts.coverNote,
        status: opts.status ?? "SUBMITTED",
        revisionCount: opts.revisedFrom ? 1 : 0,
      },
    });
    if (opts.revisedFrom) {
      await prisma.bidRevision.create({
        data: {
          bidId: bid.id, revisionNumber: 1, totalPrice: opts.revisedFrom,
          breakdown: distributeByPercents(opts.revisedFrom, percents), timelineWeeks: opts.timelineWeeks + 2,
          materialsSpec: MATERIALS[opts.materials], warrantyYears: opts.warrantyYears,
          paymentMilestones: toJson(defaultPaymentMilestones(opts.floors)), demoType: opts.demoType,
          demoUrls: bid.demoUrls, coverNote: opts.coverNote, createdAt: daysFromNow(-1),
        },
      });
    }
    return bid;
  }

  // 1) OPEN — Priya, Whitefield G+1, three bids (within / above / unusually low)
  const p1 = await createProject({
    homeownerId: priya.id, title: "G+1 family home in Whitefield", city: "Bengaluru", locality: "Whitefield",
    plotLengthFt: 40, plotWidthFt: 60, builtUpAreaSqft: 2400, floors: 2, bedrooms: 4, bathrooms: 4, parking: true,
    facing: "EAST", vastuRequired: true, preferredPackage: "STANDARD", extraSump: true, extraCompoundWall: true,
    budgetMin: 5_000_000, budgetMax: 6_200_000, startTimeline: "1–3 months",
    notes: "Ground floor for parents with an accessible bathroom. Want a home office on the first floor.",
    status: "OPEN", publishedAt: daysFromNow(-2), bidDeadline: daysFromNow(5),
  });
  const b1 = await createBid({
    projectId: p1.project.id, builder: namma, totalPrice: 5_480_000, pkg: "STANDARD", floors: 2, timelineWeeks: 32,
    warrantyYears: 10, materials: "standard", demoType: "PORTFOLIO", status: "SHORTLISTED", revisedFrom: 5_720_000,
    coverNote: "We've built 12 homes within 3 km of your plot. Price includes sump and compound wall, a dedicated site engineer, and weekly photo updates.",
  });
  await createBid({
    projectId: p1.project.id, builder: shilpa, totalPrice: 6_350_000, pkg: "STANDARD", floors: 2, timelineWeeks: 36,
    warrantyYears: 15, materials: "premium", demoType: "DESIGN_LINK", demoUrls: ["https://example.com/demo/whitefield-elevation"],
    coverNote: "Premium-grade materials at standard layout. 15-year structural warranty and a 3D walkthrough of your elevation is linked.",
  });
  const b3 = await createBid({
    projectId: p1.project.id, builder: urbannest, totalPrice: 3_550_000, pkg: "STANDARD", floors: 2, timelineWeeks: 26,
    warrantyYears: 5, materials: "budget", demoType: "IMAGES", demoUrls: ["/seed/house-3.svg", "/seed/house-5.svg"],
    coverNote: "Fastest timeline in the market. We keep costs low with a lean team and local material sourcing.",
  });

  // 2) OPEN — Meera, Mysuru, one bid
  const p2 = await createProject({
    homeownerId: meera.id, title: "Compact G house near Kuvempunagar", city: "Mysuru", locality: "Kuvempunagar",
    plotLengthFt: 30, plotWidthFt: 40, builtUpAreaSqft: 1100, floors: 1, bedrooms: 2, bathrooms: 2, parking: true,
    facing: "NORTH", vastuRequired: true, preferredPackage: "BASIC", extraSolar: true,
    budgetMin: 1_800_000, budgetMax: 2_300_000, startTimeline: "Within 1 month",
    status: "OPEN", publishedAt: daysFromNow(-1), bidDeadline: daysFromNow(6),
  });
  await createBid({
    projectId: p2.project.id, builder: sthapathi, totalPrice: 2_090_000, pkg: "BASIC", floors: 1, timelineWeeks: 26,
    warrantyYears: 10, materials: "budget", demoType: "PORTFOLIO",
    coverNote: "Vastu-compliant layout included. We have an active site in Saraswathipuram so supervision is daily.",
  });

  // 3) UNDER_REVIEW — Priya, JP Nagar duplex, deadline passed
  const p3 = await createProject({
    homeownerId: priya.id, title: "Duplex for rental income in JP Nagar", city: "Bengaluru", locality: "JP Nagar 7th Phase",
    plotLengthFt: 30, plotWidthFt: 40, builtUpAreaSqft: 2000, floors: 2, bedrooms: 4, bathrooms: 3, parking: true,
    facing: "NORTH_EAST", vastuRequired: false, preferredPackage: "BASIC",
    budgetMin: 3_500_000, budgetMax: 4_200_000, startTimeline: "3–6 months",
    status: "UNDER_REVIEW", publishedAt: daysFromNow(-9), bidDeadline: daysFromNow(-2),
  });
  await createBid({
    projectId: p3.project.id, builder: namma, totalPrice: 3_980_000, pkg: "BASIC", floors: 2, timelineWeeks: 30,
    warrantyYears: 10, materials: "budget", demoType: "PORTFOLIO",
    coverNote: "Two independent 2BHK units with separate meters and staircase. Price includes approvals liaison.",
  });
  await createBid({
    projectId: p3.project.id, builder: sthapathi, totalPrice: 3_720_000, pkg: "BASIC", floors: 2, timelineWeeks: 34,
    warrantyYears: 7, materials: "budget", demoType: "VIDEO", demoUrls: ["https://example.com/demo/jpnagar-walkthrough.mp4"],
    status: "SHORTLISTED", coverNote: "Optimised for rental: low-maintenance finishes and separate sumps per unit.",
  });
  await createBid({
    projectId: p3.project.id, builder: urbannest, totalPrice: 4_450_000, pkg: "BASIC", floors: 2, timelineWeeks: 28,
    warrantyYears: 5, materials: "standard", demoType: "IMAGES", demoUrls: ["/seed/house-2.svg"],
    coverNote: "Upgraded to standard-grade tiles and fittings at no change to timeline.",
  });

  // 4) AWARDED — Rahul, HSR G+2, awarded to Shilpa, with review
  const p4 = await createProject({
    homeownerId: rahul.id, title: "G+2 home with terrace garden in HSR Layout", city: "Bengaluru", locality: "HSR Layout Sector 2",
    plotLengthFt: 30, plotWidthFt: 50, builtUpAreaSqft: 3600, floors: 3, bedrooms: 5, bathrooms: 5, parking: true,
    facing: "WEST", vastuRequired: false, preferredPackage: "PREMIUM", extraLift: true, extraSolar: true,
    budgetMin: 9_500_000, budgetMax: 11_500_000, startTimeline: "Immediately",
    status: "AWARDED", publishedAt: daysFromNow(-20), bidDeadline: daysFromNow(-13), awardedAt: daysFromNow(-10),
  });
  const awarded = await createBid({
    projectId: p4.project.id, builder: shilpa, totalPrice: 10_850_000, pkg: "PREMIUM", floors: 3, timelineWeeks: 44,
    warrantyYears: 15, materials: "premium", demoType: "PORTFOLIO", status: "AWARDED",
    coverNote: "Includes 4-stop lift, terrace garden waterproofing and solar. Dedicated project manager.",
  });
  await createBid({
    projectId: p4.project.id, builder: namma, totalPrice: 10_200_000, pkg: "PREMIUM", floors: 3, timelineWeeks: 46,
    warrantyYears: 10, materials: "premium", demoType: "PORTFOLIO", status: "REJECTED",
    coverNote: "Premium spec with Tata steel and Kohler fittings; lift by Kone.",
  });
  await prisma.project.update({ where: { id: p4.project.id }, data: { awardedBidId: awarded.id } });
  await prisma.review.create({
    data: { projectId: p4.project.id, builderId: shilpa.profile.id, homeownerId: rahul.id, rating: 5, comment: "Clear BOQ, weekly updates and the site was always clean. Highly recommend." },
  });

  // 5) DRAFT — Meera
  await createProject({
    homeownerId: meera.id, title: "Retirement home in Yelahanka (draft)", city: "Bengaluru", locality: "Yelahanka New Town",
    plotLengthFt: 40, plotWidthFt: 60, builtUpAreaSqft: 1800, floors: 1, bedrooms: 3, bathrooms: 3, parking: true,
    facing: "SOUTH_EAST", vastuRequired: true, preferredPackage: "PREMIUM",
    budgetMin: 4_000_000, budgetMax: 5_000_000, startTimeline: "Just exploring", status: "DRAFT",
  });

  console.log("Seeding messages and notifications…");
  const chat: Array<[string, string, string]> = [
    [b1.id, priya.id, "Hi, does your price include the electrical point upgrades for EV charging in the parking?"],
    [b1.id, namma.user.id, "Yes — one 16A EV point is included. We can add a second for about ₹18,000."],
    [b1.id, priya.id, "Great. Can you share the BOQ for flooring separately?"],
    [b3.id, priya.id, "Your price is much lower than the others. Can you send a detailed BOQ?"],
  ];
  for (const [i, [bidId, senderId, body]] of chat.entries()) {
    await prisma.message.create({
      data: { bidId, projectId: p1.project.id, senderId, body, createdAt: new Date(Date.now() - (chat.length - i) * 3600_000) },
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: priya.id, type: "BID_RECEIVED", payload: { title: "New bid received", body: `Shilpa Premium Villas bid ₹63,50,000 on "${p1.project.title}".`, href: `/projects/${p1.project.id}` } },
      { userId: priya.id, type: "BID_RECEIVED", payload: { title: "New bid received", body: `UrbanNest Homes bid ₹35,50,000 on "${p1.project.title}".`, href: `/projects/${p1.project.id}` } },
      { userId: priya.id, type: "BIDDING_CLOSED", payload: { title: "Bidding closed", body: `Bidding has closed for "${p3.project.title}". Compare the 3 bids and award a builder.`, href: `/projects/${p3.project.id}` } },
      { userId: meera.id, type: "BID_RECEIVED", payload: { title: "New bid received", body: `Sthapathi Builders bid ₹20,90,000 on "${p2.project.title}".`, href: `/projects/${p2.project.id}` } },
      { userId: namma.user.id, type: "BID_SHORTLISTED", payload: { title: "You've been shortlisted!", body: `The homeowner shortlisted your bid for "${p1.project.title}".`, href: `/bids/${b1.id}` } },
      { userId: shilpa.user.id, type: "BID_AWARDED", payload: { title: "🎉 You won the project", body: `Your bid for "${p4.project.title}" was awarded.`, href: `/bids/${awarded.id}` }, read: true },
      { userId: sthapathi.user.id, type: "PROJECT_PUBLISHED", payload: { title: "New project in Mysuru", body: `"${p2.project.title}" is open for bids.`, href: `/builder/projects/${p2.project.id}` }, read: true },
    ],
  });

  const counts = await Promise.all([prisma.user.count(), prisma.project.count(), prisma.bid.count(), prisma.estimatorRate.count()]);
  console.log(`Done: ${counts[0]} users, ${counts[1]} projects, ${counts[2]} bids, ${counts[3]} rates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
