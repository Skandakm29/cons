/**
 * Production-safe seed. Never deletes anything.
 *  - Adds estimator rates for any city/package that has none (existing, admin-edited rates are kept).
 *  - Creates the admin account from ADMIN_PHONE / ADMIN_EMAIL / ADMIN_NAME if it doesn't exist,
 *    or adds ADMIN_EMAIL to an existing admin that has none (so they can log in by email or Google).
 *
 * Usage: ADMIN_PHONE=98xxxxxxxx ADMIN_EMAIL=you@gmail.com ADMIN_NAME="Your Name" npm run seed:prod
 */
import { PrismaClient, type Package } from "@prisma/client";
import { phoneSchema } from "../lib/validation/common";
import { emailSchema } from "../lib/validation/auth";
import { PLACEHOLDER_RATES, splitFor } from "./rates";

const prisma = new PrismaClient();

async function main() {
  let added = 0;
  for (const [city, pkgs] of Object.entries(PLACEHOLDER_RATES)) {
    for (const [pkg, [low, high]] of Object.entries(pkgs) as [Package, [number, number]][]) {
      const exists = await prisma.estimatorRate.findUnique({ where: { city_package: { city, package: pkg } } });
      if (exists) continue;
      await prisma.estimatorRate.create({
        data: { city, package: pkg, ratePerSqftLow: low, ratePerSqftHigh: high, breakdownPercents: splitFor(pkg) },
      });
      added++;
    }
  }
  console.log(added ? `Added ${added} placeholder estimator rates — edit them at /admin/rates.` : "Estimator rates already present; left unchanged.");

  const rawPhone = process.env.ADMIN_PHONE;
  if (!rawPhone) {
    console.log("ADMIN_PHONE not set — skipping admin account.");
    return;
  }
  const phone = phoneSchema.parse(rawPhone);
  const email = process.env.ADMIN_EMAIL ? emailSchema.parse(process.env.ADMIN_EMAIL) : null;
  if (email) {
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner && owner.phone !== phone) throw new Error(`${email} already belongs to another account (${owner.role}).`);
  }
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.role !== "ADMIN") throw new Error(`+91${phone} already exists as ${existing.role}; refusing to change its role.`);
    if (email && existing.email !== email) {
      if (existing.email) throw new Error(`Admin already has email ${existing.email}; refusing to replace it.`);
      await prisma.user.update({ where: { id: existing.id }, data: { email } });
      console.log(`Added ${email} to admin +91${phone}. You can now log in with email or Google.`);
    } else {
      console.log(`Admin +91${phone} already exists.`);
    }
  } else {
    await prisma.user.create({ data: { phone, phoneVerified: true, email, name: process.env.ADMIN_NAME || "Admin", role: "ADMIN" } });
    console.log(`Created admin account for +91${phone}${email ? ` (${email})` : ""}. Log in at /login.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
