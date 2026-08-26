import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Points-engine tests share one replica set per file (see dbTestUtils.ts);
    // running files in parallel processes would each spin up their own.
    fileParallelism: false,
  },
});
