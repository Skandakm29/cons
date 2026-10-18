import { defineConfig } from "vitest/config";
import path from "node:path";

/** DB-backed tests for server actions. Requires DATABASE_URL and seeded estimator rates. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
