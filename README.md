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

In development, every email and phone number accepts the code **`123456`**. A real random code is also printed to the server console. Log in by email (the default) or switch to **Use mobile number instead**.

| Role | Name | Email | Phone | What to try |
|---|---|---|---|---|
| Admin | Asha | `admin@buildbid.test` | `9000000000` | Verify the pending builder, edit rates, moderate |
| Homeowner | Priya Sharma | `priya@buildbid.test` | `9000000001` | Whitefield project (OPEN, 3 bids incl. an unusually low one) → **Compare**; JP Nagar project (UNDER_REVIEW) |
| Homeowner | Rahul Gowda | `rahul@buildbid.test` | `9000000002` | HSR project (AWARDED, builder contact unlocked, reviewed) |
| Homeowner | Meera Iyer | `meera@buildbid.test` | `9000000003` | Mysuru project (OPEN, 1 bid) and a DRAFT to publish |
| Builder (verified) | Namma Mane Constructions | `builder1@buildbid.test` | `9100000001` | Shortlisted bid with revision history; chat |
| Builder (verified) | Sthapathi Builders | `builder2@buildbid.test` | `9100000002` | Serves Bengaluru + Mysuru |
| Builder (verified) | UrbanNest Homes | `builder3@buildbid.test` | `9100000003` | Unusually low bid |
| Builder (verified) | Shilpa Premium Villas | `builder4@buildbid.test` | `9100000004` | Won the HSR project |
| Builder (pending) | Coastal Build Co. | `builder5@buildbid.test` | `9100000005` | Can browse but not bid until verified |

### How login works

- **Google** ("Continue with Google"): first-time users then add a phone number and choose homeowner or builder.
- **Email code** (the default): a 6-digit code is emailed. Signup also asks for a mobile number, which is shared with the other party after an award. It is *not* SMS-verified, so it can't be used for SMS login.
- **Phone code (SMS)**: shown once an SMS provider is configured. Only numbers confirmed by SMS (`phoneVerified`) can log in this way.

Each email or phone number gets at most one code per 30 seconds and 5 per hour.

## Deploying to Vercel + Neon

Every push to `main` deploys automatically. Each build runs `prisma migrate deploy` (the `vercel-build` script), so schema changes ship with the code. Functions run in Singapore (`vercel.json`), next to Neon's nearest region.

### 1. Create the Vercel project
1. On vercel.com, click **Add New → Project** and import the GitHub repo. Vercel detects Next.js automatically.
2. The first deploy will fail because there's no database yet. That's expected.

### 2. Add the database and file storage (Vercel → your project → **Storage**)
1. **Create Database → Neon (Postgres)**. Pick the **Singapore** region and connect it to the project. This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, used for migrations).
   - When connecting, tick **Production** only, or turn on Neon's per-preview branches. Otherwise preview deployments will write to your live database.
2. **Create → Blob** and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.

### 3. Set environment variables (Settings → Environment Variables)

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | Your site URL, e.g. `https://buildbid.vercel.app` (change it later if you add a custom domain) |
| `NEXTAUTH_SECRET` | Output of `openssl rand -base64 32` (don't reuse the dev value) |
| `STORAGE_PROVIDER` | `vercel-blob` |
| `OTP_PROVIDER` | `mock` until you pick an SMS provider (see step 6) |
| `OTP_TEST_NUMBERS` | Your own number(s), comma-separated. These can log in with `123456`. |

With `OTP_PROVIDER=mock` in production, only the test numbers can log in. Everyone else sees "SMS login isn't switched on yet". That makes it a safe soft launch.

### 4. Redeploy
Go to **Deployments → ⋯ → Redeploy**. The build creates all the tables.

### 5. Load the estimator rates and create your admin account (from your laptop, once)
Copy the two connection strings from Vercel (Storage → your Neon database → `.env.local` tab), then run:

```bash
DATABASE_URL="<pooled url>" DATABASE_URL_UNPOOLED="<unpooled url>" \
ADMIN_PHONE=98xxxxxxxx ADMIN_NAME="Your Name" npm run seed:prod
```

This never deletes anything. It adds any missing placeholder rates and creates the admin account, and is safe to re-run. Your admin number must be in `OTP_TEST_NUMBERS` to log in before SMS is set up. Then log in and **replace the placeholder rates at `/admin/rates`**.

> Never run `npm run seed` against production: it wipes all data and creates demo accounts with public phone numbers. It refuses to run against a non-local database unless `ALLOW_DEMO_SEED=1` is set.

### 6. Switch on login for real users
Each option is independent. Set its variables, then redeploy.

**Email codes (free).** Gmail works without owning a domain:
1. On the Google account you'll send from, turn on 2-Step Verification, then create an **App password** at myaccount.google.com/apppasswords.
2. Set `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com` and `SMTP_PASS=<the 16-character app password>`.
3. Gmail allows about 500 emails a day. Once you own a domain, switch the same settings to Resend, Brevo or Zoho SMTP for better deliverability.

**Google sign-in (free).**
1. At console.cloud.google.com, create a project. Go to **APIs & Services → OAuth consent screen**: choose External, fill in the app name and support email, then click **Publish app**. Basic email/profile scopes need no Google review.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**. Add the authorised redirect URI `https://<your-domain>/api/auth/callback/google`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The button appears once both are set.

To let your admin log in this way, re-run `seed:prod` with `ADMIN_EMAIL=you@gmail.com` (plus the same `ADMIN_PHONE`). It adds the email to the existing admin account.

**SMS codes (paid per message).** Pick one:
- **Twilio Verify** (fastest to start; Twilio handles Indian DLT compliance): create a Verify Service in the Twilio console, then set `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID`.
- **MSG91** (cheaper per SMS): register your sender ID and OTP template on DLT, then set `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` and `MSG91_OTP_VAR` (the variable name in your template, default `otp`).

Trim `OTP_TEST_NUMBERS` down to just the numbers you still need. Each phone number can request at most 5 codes per hour, which limits SMS-pumping costs.

### 7. Custom domain (optional)
Go to **Settings → Domains**, add your domain, then update `NEXTAUTH_URL` and redeploy.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (estimator, INR formatting, price bands, OTP providers). No DB needed. |
| `npm run test:integration` | DB-backed tests that call the real server actions (posting, sealed bidding, revisions, award, chat redaction, reviews, deadline). Run `npm run seed` first. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Reset demo data (local databases only) |
| `npm run seed:prod` | Production-safe: add missing rates and create the admin from `ADMIN_PHONE` |
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
| `EmailSender` | `lib/auth/email.ts` | `mock` (console), `smtp` via `EMAIL_PROVIDER` | Any SMTP service, or an HTTP API sender |
| `OtpProvider` | `lib/auth/otp.ts` | `mock` (console), `twilio` (Twilio Verify), `msg91` via `OTP_PROVIDER` | Add more providers by implementing `OtpProvider` or `HostedOtpProvider` |
| `StorageService` | `lib/services/storage.ts` | `local` → `public/uploads`, `vercel-blob` via `STORAGE_PROVIDER` | S3 / Cloudinary |
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
- **Uploads**: JPG/PNG/WebP (images) and PDF (licence documents only), up to 4 MB (Vercel rejects request bodies over 4.5 MB), type-checked by magic bytes. Builders and admins can upload; homeowners have nothing to upload yet. Local dev writes to `public/uploads`; production uses Vercel Blob.
- **Admin** accounts can't be created through signup; they are seeded.
- **Unverified contact numbers**: a number entered at email or Google signup isn't SMS-verified but is still unique. Someone could register another person's number, blocking that person from signing up with it. Verifying numbers by SMS once SMS is cheap enough would close this.
- **ESLint** isn't installed in the base version (`next build` still type-checks).

## Next steps

- **OTP hardening**: per-IP rate limiting and a CAPTCHA on the login form.
- **Storage**: image resizing and thumbnails; signed client uploads for files larger than 4 MB.
- **Payments and escrow**: milestone-linked payments released on homeowner approval.
- **Milestone tracking**: site photos and progress updates per milestone (e-monitoring), with delay alerts.
- **WhatsApp / SMS notifications** via new `NotificationChannel`s.
- **Reviews and trust**: post-handover reviews, verified review badges, dispute resolution.
- A background scheduler for deadlines and reminders; real-time chat (websockets).
- Real market rates per locality; more cities; floor-plan and elevation uploads from homeowners.
# cons
