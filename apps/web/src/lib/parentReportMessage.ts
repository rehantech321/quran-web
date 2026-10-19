import type { TFunction } from "i18next";

import { EVALUATION_LABEL_KEYS } from "@/lib/memorizationEvaluation";
import { PERIOD_LABEL_KEYS, type ReportPeriod } from "@/lib/reportPeriod";
import type { ParentWeeklyReport, ParentWeeklyReportAyahEntry } from "@/queries/reports";

function completedTaskLine(
  t: TFunction,
  labelKey: string,
  entry: ParentWeeklyReportAyahEntry,
): string {
  const range = t("parentReport.ayahRangeLine", {
    surah: entry.surahName,
    from: entry.fromAyah,
    to: entry.toAyah,
  });
  // The teacher's recitation rating is the whole reason this feature was
  // asked for ("it is very important for parents to see the evaluation") —
  // appended in parentheses right after the range it applies to, not
  // dropped just because it's optional data.
  const evaluation = entry.evaluation
    ? ` (${t(EVALUATION_LABEL_KEYS[entry.evaluation])})`
    : "";
  return `${t(labelKey)}: ${range}${evaluation}`;
}

/**
 * Builds the parent-facing report as plain text for WhatsApp, in the exact
 * format the app owner specified: a greeting, "Student Report: <name>",
 * "Report Period: <Daily/Weekly/Monthly>", attendance as actual day counts
 * (never a percentage), correct question answers, a "Completed Tasks" list
 * of memorization/revision portions, and points earned within that period —
 * not the student's all-time total, since a monthly report should show what
 * was earned that month.
 */
export function buildParentWeeklyReportMessage(
  t: TFunction,
  report: ParentWeeklyReport,
  period: ReportPeriod,
  orgName?: string,
): string {
  const lines = [
    t("parentReport.greeting"),
    "",
    t("parentReport.studentReportLabel", { name: report.student.fullName }),
    "",
    t("parentReport.periodLabel", { period: t(PERIOD_LABEL_KEYS[period]) }),
    "",
    // "Present" here means "attended" — a late arrival still attended, same
    // as `attendanceRate` elsewhere in the app treats present+late as
    // attendance. Without this, a student who arrived late every day would
    // show 0 days attended, which looked like they never showed up at all.
    `${t("parentReport.daysPresent")}: ${report.attendance.present + report.attendance.late}`,
    `${t("parentReport.daysAbsent")}: ${report.attendance.absent}`,
    `${t("parentReport.correctAnswers")}: ${report.correctAnswers}`,
    "",
    t("parentReport.completedTasksHeading") + ":",
    ...(report.newMemorization.length === 0 && report.revision.length === 0
      ? [t("parentReport.noCompletedTasks")]
      : [
          ...report.newMemorization.map(
            (e) => `- ${completedTaskLine(t, "parentReport.memorizationLabel", e)}`,
          ),
          ...report.revision.map(
            (e) => `- ${completedTaskLine(t, "parentReport.revisionLabel", e)}`,
          ),
        ]),
    "",
    `${t("parentReport.pointsEarned")}: ${report.periodPoints}`,
  ];

  if (orgName) {
    lines.push("", t("parentReport.footer", { orgName }));
  }

  return lines.join("\n");
}
