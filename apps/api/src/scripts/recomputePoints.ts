import "dotenv/config";

import mongoose from "mongoose";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Student } from "../models/Student.js";
import { recomputeStudentPoints } from "../services/points.service.js";

/**
 * Safety-net CLI (SPEC.md §5.4): rebuilds every student's totalPoints/pointsBreakdown
 * cache from the PointsLedger, the source of truth. Run via `pnpm recompute-points`.
 */
async function main() {
  await mongoose.connect(env.MONGODB_URI);

  const students = await Student.find({}, { _id: 1 }).lean();
  logger.info({ count: students.length }, "Recomputing points caches");

  for (const student of students) {
    await recomputeStudentPoints(student._id);
  }

  logger.info("Done");
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "recompute-points failed");
  process.exit(1);
});
