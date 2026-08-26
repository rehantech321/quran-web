import { customAlphabet } from "nanoid";

import { STUDENT_SLUG_ALPHABET, STUDENT_SLUG_LENGTH } from "@halaqat/shared";

const generateSlug = customAlphabet(STUDENT_SLUG_ALPHABET, STUDENT_SLUG_LENGTH);

export function generateStudentAccessSlug(): string {
  return generateSlug();
}
