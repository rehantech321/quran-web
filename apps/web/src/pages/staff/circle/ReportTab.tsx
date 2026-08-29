import { useTranslation } from "react-i18next";

import { Button, Card, SkeletonText } from "@/components/ui";
import { downloadReportExport, useCircleReport } from "@/queries/reports";

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl text-primary-900">{value}</p>
      <p className="text-xs text-ink-600">{label}</p>
    </div>
  );
}

export function ReportTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: report, isLoading } = useCircleReport(circleId);

  if (isLoading || !report) {
    return (
      <Card className="p-4">
        <SkeletonText lines={5} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        <StatBlock
          label={t("reports.avgAttendance")}
          value={report.summary.avgAttendanceRate ?? "—"}
        />
        <StatBlock label={t("reports.avgGrade")} value={report.summary.avgGrade ?? "—"} />
        <StatBlock
          label={t("reports.questionAccuracy")}
          value={report.summary.avgQuestionAccuracy ?? "—"}
        />
        <StatBlock
          label={t("reports.tasksCompleted")}
          value={report.summary.totalTasksCompleted}
        />
        <StatBlock label={t("reports.totalPoints")} value={report.summary.totalPoints} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => downloadReportExport("circle", "csv", circleId)}
        >
          {t("reports.exportCsv")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => downloadReportExport("circle", "pdf", circleId)}
        >
          {t("reports.exportPdf")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {report.students.map((row) => (
          <Card key={row.studentId} className="flex flex-col gap-1 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-900">{row.fullName}</span>
              <span className="font-display text-sm text-primary-900">
                {row.totalPoints} {t("common.points")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
              {row.level && (
                <span>
                  {t("student.level")}: {row.level}
                </span>
              )}
              <span>
                {t("reports.avgAttendance")}: {row.attendanceRate ?? "—"}%
              </span>
              <span>
                {t("reports.latestGrade")}: {row.latestGrade ?? "—"}
              </span>
              <span>
                {t("reports.tasksCompleted")}: {row.tasksCompleted}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
