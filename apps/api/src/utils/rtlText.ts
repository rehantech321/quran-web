// Arabic (U+0600-06FF), Arabic Supplement (U+0750-077F), Arabic Extended-A
// (U+08A0-08FF), and Arabic Presentation Forms A/B (U+FB50-FDFF, U+FE70-FEFE
// — stops one short of U+FEFF, which is the BOM/zero-width-no-break-space,
// not an Arabic character, and trips ESLint's no-irregular-whitespace rule
// if included literally).
const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻾]/u;

/**
 * pdfkit (via fontkit) shapes Arabic glyphs correctly *within* a word —
 * joined letter forms render fine — but pdfkit implements none of the
 * Unicode Bidirectional Algorithm: it draws a string's characters left to
 * right in whatever order they appear, regardless of the text's actual
 * direction. For an RTL string that means the first word (which belongs on
 * the right) ends up drawn first, on the left — the whole line reads
 * backwards, even though each individual word is internally correct.
 *
 * Reversing word order (not character order) fixes this without a full
 * bidi implementation: each word's internal character sequence — including
 * any embedded LTR run, e.g. a number — is left untouched; only the
 * sequence of words along the line is corrected. Good enough for the short
 * labels/names/values a generated report actually contains; not a general
 * bidi engine.
 */
export function toVisualRtl(text: string): string {
  if (!ARABIC_RANGE.test(text)) return text;
  return text.split(" ").reverse().join(" ");
}
