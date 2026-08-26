import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setupEnv.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Points-engine tests share one replica set per file (see dbTestUtils.ts);
    // running files in parallel processes would each spin up their own.
    fileParallelism: false,
  },
});
