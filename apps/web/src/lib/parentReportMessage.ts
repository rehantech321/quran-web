import type { TFunction } from "i18next";

import type { ParentWeeklyReport, ParentWeeklyReportAyahEntry } from "@/queries/reports";

function ayahRangeLine(t: TFunction, entry: ParentWeeklyReportAyahEntry): string {
  return t("parentReport.ayahRangeLine", {
    surah: entry.surahName,
    from: entry.fromAyah,
    to: entry.toAyah,
  });
}

/**
 * Builds the parent-facing weekly report as plain text for WhatsApp — the
 * same data the in-app card renders as sections, flattened into a single
 * message. Attendance is always the actual day counts the API returns
 * (never a percentage): a parent asked for this explicitly, since "80%"
 * doesn't say how many sessions that was out of.
 */
export function buildParentWeeklyReportMessage(
  t: TFunction,
  report: ParentWeeklyReport,
  locale: string,
  orgName?: string,
): string {
  const from = new Date(report.range.from).toLocaleDateString(locale);
  const to = new Date(report.range.to).toLocaleDateString(locale);

  const lines = [
    t("parentReport.greeting", { name: report.student.fullName }),
    t("parentReport.periodLine", { from, to }),
    "",
    t("parentReport.newMemorizationHeading") + ":",
    ...(report.newMemorization.length > 0
      ? report.newMemorization.map((e) => `- ${ayahRangeLine(t, e)}`)
      : [t("parentReport.noNewMemorization")]),
    "",
    t("parentReport.revisionHeading") + ":",
    ...(report.revision.length > 0
      ? report.revision.map((e) => `- ${ayahRangeLine(t, e)}`)
      : [t("parentReport.noRevision")]),
    "",
    t("parentReport.attendanceHeading") + ":",
    // "Present" here means "attended" — a late arrival still attended, same
    // as `attendanceRate` elsewhere in the app treats present+late as
    // attendance. Without this, a student who arrived late every day would
    // show 0 days attended, which looked like they never showed up at all.
    `${t("parentReport.daysPresent")}: ${report.attendance.present + report.attendance.late}`,
    `${t("parentReport.daysAbsent")}: ${report.attendance.absent}`,
    "",
    t("parentReport.pointsHeading") + ":",
    `${t("parentReport.totalPoints")}: ${report.student.totalPoints}`,
  ];

  if (report.rank) {
    lines.push(
      `${t("parentReport.rankInCircle")}: ${t("parentReport.rankValue", {
        rank: report.rank.rank,
        total: report.rank.outOf,
      })}`,
    );
  }

  if (orgName) {
    lines.push("", t("parentReport.footer", { orgName }));
  }

  return lines.join("\n");
}
