import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";

import { ValidationError } from "../errors.js";

// apps/api/uploads/ — sits next to src/ and dist/ regardless of dev (tsx,
// running from src/) or prod (node, running from dist/), unlike src/assets/
// which needs a build-time copy step: this directory holds runtime-written
// files, not a build artifact, so there's nothing to copy in the first
// place. Already gitignored (see .gitignore's `uploads/` entry).
const UPLOADS_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "uploads",
);
export const STUDENT_PHOTOS_DIR = path.join(UPLOADS_ROOT, "students");

if (!existsSync(STUDENT_PHOTOS_DIR)) {
  mkdirSync(STUDENT_PHOTOS_DIR, { recursive: true });
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const uploadStudentPhoto = multer({
  storage: multer.diskStorage({
    destination: STUDENT_PHOTOS_DIR,
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] ?? "";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PHOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!(file.mimetype in EXT_BY_MIME)) {
      cb(new ValidationError("Photo must be a JPEG, PNG, or WebP image"));
      return;
    }
    cb(null, true);
  },
}).single("photo");
