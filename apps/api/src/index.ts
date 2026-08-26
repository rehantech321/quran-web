import mongoose from "mongoose";

import { createApp } from "@/app.js";
import { env } from "@/config/env.js";
import { logger } from "@/config/logger.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("Connected to MongoDB");

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start API");
  process.exit(1);
});
