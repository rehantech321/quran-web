import type { LedgerSource } from "@halaqat/shared";

/**
 * Human-readable Arabic labels for ledger `source`/`reason` values — used
 * only in generated exports (CSV/PDF), which have no i18next context of
 * their own (unlike the in-app points-history screen, which translates the
 * same `reason` keys client-side via the `ledger.*` i18n namespace). Kept in
 * sync with that namespace's keys.
 */
const SOURCE_LABELS_AR: Record<LedgerSource, string> = {
  attendance: "حضور",
  grade: "درجة",
  question: "سؤال",
  task: "مهمة",
  manual: "تعديل يدوي",
};

const REASON_LABELS_AR: Record<string, string> = {
  "ledger.attendance.present": "حضور",
  "ledger.attendance.late": "تأخير",
  "ledger.attendance.absent": "غياب",
  "ledger.attendance.excused": "عذر",
  "ledger.grade.recorded": "درجة",
  "ledger.question.correct": "إجابة صحيحة على السؤال الأسبوعي",
  "ledger.task.approved": "اعتماد مهمة",
  "ledger.reversal": "تصحيح",
};

export function sourceLabelAr(source: LedgerSource): string {
  return SOURCE_LABELS_AR[source] ?? source;
}

export function reasonLabelAr(reason: string): string {
  return REASON_LABELS_AR[reason] ?? reason;
}
