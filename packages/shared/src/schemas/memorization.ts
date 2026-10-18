import { z } from "zod";

import { MEMORIZATION_EVALUATIONS } from "../constants.js";
import { QURAN_SURAH_BY_NUMBER } from "../quran.js";
import { objectIdSchema, paginationQuerySchema } from "./common.js";

/**
 * A single Surah + ayah range (used for both the "new memorization" portion
 * and the "revision" portion of a daily record) — validated against the
 * real ayah count of the chosen surah, not just a generic positive integer,
 * so a typo like "Al-Fatihah ayah 1 to 50" is rejected server-side rather
 * than silently stored as a nonsense range.
 */
export const ayahRangeSchema = z
  .object({
    surahNumber: z.number().int().min(1).max(114),
    fromAyah: z.number().int().min(1),
    toAyah: z.number().int().min(1),
    // The teacher's rating of how well the student recited this portion —
    // optional since a record can be logged before the student has recited
    // it to anyone yet.
    evaluation: z.enum(MEMORIZATION_EVALUATIONS).optional(),
  })
  .refine((v) => v.fromAyah <= v.toAyah, {
    message: "fromAyah_must_be_less_than_or_equal_to_toAyah",
    path: ["toAyah"],
  })
  .refine(
    (v) => {
      const surah = QURAN_SURAH_BY_NUMBER.get(v.surahNumber);
      return surah !== undefined && v.toAyah <= surah.ayahCount;
    },
    { message: "toAyah_exceeds_this_surahs_ayah_count", path: ["toAyah"] },
  );
export type AyahRangeInput = z.infer<typeof ayahRangeSchema>;

/**
 * One daily record for a student: the new portion they memorized that day,
 * their revision of previously-memorized portions, or both — at least one
 * is required, since a record with neither would mean nothing happened.
 */
export const recordMemorizationSchema = z
  .object({
    studentId: objectIdSchema,
    circleId: objectIdSchema,
    date: z.coerce.date().optional(),
    newMemorization: ayahRangeSchema.optional(),
    revision: ayahRangeSchema.optional(),
  })
  .refine((v) => v.newMemorization !== undefined || v.revision !== undefined, {
    message: "at_least_one_of_newMemorization_or_revision_is_required",
    path: ["newMemorization"],
  });
export type RecordMemorizationInput = z.infer<typeof recordMemorizationSchema>;

export const memorizationQuerySchema = z
  .object({
    studentId: objectIdSchema.optional(),
    circleId: objectIdSchema.optional(),
  })
  .merge(paginationQuerySchema);
export type MemorizationQuery = z.infer<typeof memorizationQuerySchema>;
