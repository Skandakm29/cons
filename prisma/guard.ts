/** The demo seed deletes everything. Refuse unless the database is clearly a local one. */
export function assertSafeToWipe(): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // fall through with empty host
  }
  const local = ["localhost", "127.0.0.1", "::1", "db", "postgres"].includes(host);
  if (!local && process.env.ALLOW_DEMO_SEED !== "1") {
    console.error(
      `Refusing to run the demo seed against "${host || "an unknown host"}": it deletes ALL data.\n` +
        "For production use `npm run seed:prod`. To override for a throwaway database, set ALLOW_DEMO_SEED=1.",
    );
    process.exit(1);
  }
}
