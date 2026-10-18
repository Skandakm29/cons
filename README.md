# BuildBid — construction tender platform (base version)

BuildBid is a **reverse-tender marketplace for building a house**, launching in Bengaluru.
Homeowners usually get one quote from one contractor and can't tell whether it's fair. With BuildBid:

1. **A homeowner posts a project**: plot, built-up area, floors, rooms, budget, timeline and preferred package.
2. **We suggest a price and a plan**: the estimator returns a benchmark cost range, a BOQ-style category breakdown, a recommended package, a timeline and a milestone payment schedule.
3. **Verified builders submit sealed quotes**: price with breakdown, timeline, materials and brands, warranty, payment milestones and a demo (portfolio, design link, video or images).
4. **The homeowner compares and awards**: up to 4 bids side by side against our benchmark, then shortlist, chat, and award.

We don't build anything ourselves: BuildBid runs the tender and holds builders accountable.

> The product name is set in one place: `APP_NAME` in [`lib/config.ts`](lib/config.ts).

## Tech stack

Next.js 15 (App Router) + TypeScript · Tailwind CSS + shadcn/ui-style components (Radix) · PostgreSQL + Prisma 6 · NextAuth v4 (phone OTP, JWT sessions) · Zod (shared by forms and server actions) · React Hook Form · Vitest.

## Setup

Requirements: Node 20+ and either Docker or a local PostgreSQL installation.

```bash
cp .env.example .env            # then set NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d            # Postgres 16 on localhost:5433
npm install
npx prisma migrate dev          # creates the schema
npm run seed                    # demo data (wipes and recreates all data)
npm run dev                     # http://localhost:3000
```

**No Docker?** `npm run db:local` starts a user-owned Postgres cluster in `./.pgdata` on port 5433 with the same credentials, so `.env.example` works unchanged. It needs the PostgreSQL server binaries, e.g. `apt install postgresql`.

### Demo logins

In development, every phone number accepts the OTP **`123456`**. A real random code is also printed to the server console.

| Role | Name | Phone | What to try |
|---|---|---|---|
| Admin | Asha | `9000000000` | Verify the pending builder, edit rates, moderate |
| Homeowner | Priya Sharma | `9000000001` | Whitefield project (OPEN, 3 bids incl. an unusually low one) → **Compare**; JP Nagar project (UNDER_REVIEW) |
| Homeowner | Rahul Gowda | `9000000002` | HSR project (AWARDED, builder contact unlocked, reviewed) |
| Homeowner | Meera Iyer | `9000000003` | Mysuru project (OPEN, 1 bid) and a DRAFT to publish |
| Builder (verified) | Namma Mane Constructions | `9100000001` | Shortlisted bid with revision history; chat |
| Builder (verified) | Sthapathi Builders | `9100000002` | Serves Bengaluru + Mysuru |
| Builder (verified) | UrbanNest Homes | `9100000003` | Unusually low bid |
| Builder (verified) | Shilpa Premium Villas | `9100000004` | Won the HSR project |
| Builder (pending) | Coastal Build Co. | `9100000005` | Can browse but not bid until verified |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (estimator, INR formatting, price bands). No DB needed. |
| `npm run test:integration` | DB-backed tests that call the real server actions (posting, sealed bidding, revisions, award, chat redaction, reviews, deadline). Run `npm run seed` first. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Reset demo data |
| `npm run db:local` | Start a local Postgres without Docker |

## Folder structure

```
app/                     Routes (App Router)
  page.tsx               Landing
  estimate/              Public cost calculator
  builders/[id]/         Public builder profile
  login/ signup/         Phone-OTP auth
  dashboard/             Homeowner: my projects
  projects/new/          Homeowner: 4-step project wizard
  projects/[id]/         Homeowner: estimate + bids (+ /compare)
  builder/               Builder: onboarding, open projects (+ bid form), my bids
  admin/                 Admin: builder verification, estimator rates, moderation
  bids/[id]/             Bid detail + homeowner↔builder chat (both parties)
  notifications/         In-app notifications
  api/auth/, api/upload/ NextAuth + authenticated file upload
components/
  ui/                    Button, Input, Select, Dialog, Card, Badge, Field, …
  …                      Feature components (estimate card, bid form, compare, chat, …)
lib/
  config.ts              APP_NAME, cities, business-rule constants
  estimator/             Pure, unit-tested estimator (types, config, benchmark bands)
  auth/                  NextAuth options, OtpProvider interface, session guards
  actions/               Server actions (every mutation: Zod + role + ownership checks)
  services/              Notifications, storage, estimates, project lifecycle, access control
  validation/            Zod schemas shared by client forms and server actions
  format.ts              formatINR (₹12,50,000), dates, labels
prisma/                  schema.prisma, migrations, seed.ts
tests/                   Unit tests; tests/integration for DB-backed action tests
middleware.ts            Role-based route protection
```

## How key rules are enforced

- **Roles**: `middleware.ts` gates `/admin`, `/builder`, `/dashboard` and `/projects` by role. Every page and server action also re-reads the user from the DB and checks role and ownership (`requirePageUser` / `requireActionUser`).
- **Sealed bids**: builder pages only ever query the builder's own bid. `getBidForParticipant` limits a bid to its homeowner, its builder, or an admin.
- **One bid per builder per project**: a unique constraint on `(projectId, builderId)`. Every edit writes a `BidRevision` snapshot of the previous version first.
- **Deadline**: `bidDeadline` defaults to 7 days after publishing. Bids are rejected after it. `closeExpiredBidding()` moves expired projects to `UNDER_REVIEW` and notifies everyone.
- **Award**: a single transaction marks the bid AWARDED, rejects every other live bid, closes the project, and notifies all builders.
- **Unusually low bids**: bids more than 25% below `totalLow` (`BUSINESS_RULES.unusuallyLowThreshold`) are flagged "ask for a detailed BOQ".
- **Milestones total 100%; the breakdown adds up to the total price**: checked by Zod on the client and again on the server.
- **Phone numbers stay hidden until award**: they are masked in the UI, and phone-number-like strings in chat messages are redacted server-side until the bid is awarded.
- **Money**: stored as whole rupees (`Int`) and formatted with `formatINR()` (Indian grouping). Areas are in sqft.

## Estimator

`lib/estimator` is a pure module with no DB access. `calculateEstimate(input, ratesForCity)` returns:

- `totalLow` / `totalHigh` = area × ₹/sqft × floor multiplier, plus extras
- a category breakdown in ₹ and % (largest-remainder rounding, so it always adds up to the total)
- extras (basement, lift, compound wall, sump, solar) as line items
- a recommended plan: a package suggestion with a one-line reason (budget-aware), a timeline in weeks, and a 7–8 step payment schedule

Package ₹/sqft rates and breakdown percentages exist only in the `EstimatorRate` table. Admins edit them at `/admin/rates`. **The seeded values are placeholders** (see `TODO` in `prisma/seed.ts`). Floor multipliers, extras pricing and timeline factors are in `lib/estimator/config.ts`; the extras prices are also placeholders.

## Swappable services

| Interface | Location | Current | Replace with |
|---|---|---|---|
| `OtpProvider` | `lib/auth/otp.ts` | `MockOtpProvider` (console) | MSG91 / Twilio Verify via `OTP_PROVIDER` |
| `StorageService` | `lib/services/storage.ts` | `LocalStorageService` → `public/uploads` | S3 / Cloudinary via `STORAGE_PROVIDER` |
| `NotificationChannel` | `lib/services/notifications.ts` | `InAppChannel` (DB) | Add SMS / WhatsApp channels alongside |

## Assumptions

Where the brief was ambiguous, I chose the simplest sensible option:

- **Floors** are stored as the number of above-ground storeys (1 = G, 2 = G+1 …). Built-up area is the total across all floors, and it must not exceed plot area × floors.
- **Money** is stored in whole rupees, not paise; paise precision isn't needed at house scale.
- **Supported cities**: Bengaluru and Mysuru (`SUPPORTED_CITIES`). A builder can only bid in the cities they list.
- **Deadline enforcement** has no cron. Bids are refused after `bidDeadline`, and the OPEN → UNDER_REVIEW transition runs lazily when dashboards and listings load. Move it to a scheduled job in production.
- **Drafts**: the wizard can save a DRAFT. The estimate is created immediately and re-run when the draft is published, so it uses current rates.
- **Withdrawn bids** can be resubmitted before the deadline; this reactivates the same bid record and records a revision.
- **Rejected bids** can be "reconsidered" by the homeowner while the project is still open or under review.
- **Reviews**: one per project, allowed once the project is AWARDED. `avgRating` and `ratingCount` are recalculated on each review. Seeded builders also have pre-existing ratings.
- **Chat** is per bid and refreshes every 15 s (no websockets yet).
- **Uploads**: JPG/PNG/WebP (images) and PDF (licence documents only), up to 5 MB, type-checked by magic bytes. Builders and admins can upload; homeowners have nothing to upload yet. In production, `next start` won't serve files added to `public/` after the build, which is another reason to move to S3.
- **Admin** accounts can't be created through signup; they are seeded.
- **ESLint** isn't installed in the base version (`next build` still type-checks).

## Next steps

- **Real OTP**: MSG91 or Twilio Verify behind `OtpProvider`, plus rate limiting per IP and phone.
- **Storage**: S3 or Cloudinary with signed uploads and image resizing.
- **Payments and escrow**: milestone-linked payments released on homeowner approval.
- **Milestone tracking**: site photos and progress updates per milestone (e-monitoring), with delay alerts.
- **WhatsApp / SMS notifications** via new `NotificationChannel`s.
- **Reviews and trust**: post-handover reviews, verified review badges, dispute resolution.
- A background scheduler for deadlines and reminders; real-time chat (websockets).
- Real market rates per locality; more cities; floor-plan and elevation uploads from homeowners.
# cons
