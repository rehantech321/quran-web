/**
 * Runs before any test file imports the app (env.ts validates process.env at
 * import time via a top-level `envSchema.parse`). MONGODB_URI is a placeholder —
 * tests connect via dbTestUtils' in-memory replica set instead, never this value.
 */
process.env.NODE_ENV ??= "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/halaqat_test_unused";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_0123456789ab";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_0123456789ab";
process.env.STUDENT_JWT_SECRET ??= "test_student_secret_0123456789ab";
