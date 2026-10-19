import type { ChipTone } from "@/components/ui";
import type { MemorizationEvaluation } from "@/types/api";

export const EVALUATION_LABEL_KEYS: Record<MemorizationEvaluation, string> = {
  excellent: "memorization.evaluationExcellent",
  very_good: "memorization.evaluationVeryGood",
  good: "memorization.evaluationGood",
  weak: "memorization.evaluationWeak",
};

// Color alone is never the sole carrier of meaning (SPEC.md §8) — StatusChip
// pairs each tone with its own glyph too.
export const EVALUATION_TONES: Record<MemorizationEvaluation, ChipTone> = {
  excellent: "success",
  very_good: "info",
  good: "neutral",
  weak: "warning",
};
