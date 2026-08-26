import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LeaderboardPeriod } from "@halaqat/shared";

import { Button, Card, Select, Skeleton } from "@/components/ui";
import { useCircles } from "@/queries/circles";
import { downloadReportExport, useCircleReport, useLeaderboard } from "@/queries/reports";

const PERIODS: LeaderboardPeriod[] = ["week", "month", "term", "all"];

export function Reports() {
  const { t } = useTranslation();
  const { data: circles } = useCircles();
  const [circleId, setCircleId] = useState<string>("");
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");

  const effectiveCircleId = circleId || circles?.[0]?._id;
  const { data: report, isLoading: reportLoading } = useCircleReport(effectiveCircleId);
  const { data: leaderboard } = useLeaderboard(effectiveCircleId, period);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-2xl text-primary-900">{t("nav.reports")}</h1>

      <Select
        value={effectiveCircleId ?? ""}
        onChange={(e) => setCircleId(e.target.value)}
      >
        {circles?.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </Select>

      {reportLoading || !report ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
            {[
              [t("reports.avgAttendance"), report.summary.avgAttendanceRate],
              [t("reports.avgGrade"), report.summary.avgGrade],
              [t("reports.questionAccuracy"), report.summary.avgQuestionAccuracy],
              [t("reports.tasksCompleted"), report.summary.totalTasksCompleted],
              [t("reports.totalPoints"), report.summary.totalPoints],
            ].map(([label, value]) => (
              <div key={label as string} className="text-center">
                <p className="font-display text-2xl text-primary-900">{value ?? "—"}</p>
                <p className="text-xs text-ink-600">{label}</p>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">
                {t("reports.leaderboard")}
              </h2>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value as LeaderboardPeriod)}
                className="h-9 w-32"
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {t(`reports.${p}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaderboard ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-cream-200)" />
                  <XAxis
                    dataKey="fullName"
                    tick={{ fontSize: 10 }}
                    hide={(leaderboard?.length ?? 0) > 8}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="points" fill="var(--c-gold-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadReportExport("circle", "csv", report.circle.id)}
            >
              {t("reports.exportCsv")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadReportExport("circle", "pdf", report.circle.id)}
            >
              {t("reports.exportPdf")}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {report.students.map((row) => (
              <Card
                key={row.studentId}
                className="flex items-center justify-between p-3 text-sm"
              >
                <span className="font-medium text-ink-900">{row.fullName}</span>
                <span className="font-display text-sm text-primary-900">
                  {row.totalPoints}
                </span>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
