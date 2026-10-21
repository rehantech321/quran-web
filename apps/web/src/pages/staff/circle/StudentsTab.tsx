import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  Card,
  EmptyState,
  SkeletonText,
  StatusChip,
  WeeklyMemorizationButton,
  WhatsAppButton,
} from "@/components/ui";
import { useLeaderboard } from "@/queries/reports";
import { useStudentsByCircle } from "@/queries/students";
import { downloadStudentBarcodes } from "@/utils/downloadStudentBarcodes";

const LEADERBOARD_SIZE = 5;

/**
 * Top 5 students in this specific circle, ranked by total points — a
 * separate view from the roster below it, which stays alphabetical since
 * that's what makes finding one student to manage fast. Rankings are
 * per-circle because `useLeaderboard` is called with this circle's id: the
 * backend's `/reports/leaderboard?circleId=` already scopes the points sum
 * and the sort to just that circle's students (see report.service.ts's
 * `getLeaderboard` — the same deterministic-tiebreak, all-time-points logic
 * the Champions widget and global Reports page already rely on).
 */
function CircleLeaderboard({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: leaderboard, isLoading } = useLeaderboard(circleId, "all");
  const topStudents = (leaderboard ?? []).slice(0, LEADERBOARD_SIZE);

  if (isLoading || topStudents.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-display text-lg text-primary-900">
        {t("reports.leaderboard")}
      </h2>
      <div className="flex flex-col gap-2">
        {topStudents.map((entry) => (
          <div
            key={entry.studentId}
            className="flex items-center gap-3 rounded-lg border border-cream-200 bg-cream-50 p-2"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold ${
                entry.rank === 1
                  ? "bg-gold-400 text-primary-950 ring-2 ring-gold-400"
                  : "bg-primary-900 text-cream-50"
              }`}
            >
              {entry.rank}
            </span>
            {entry.photoUrl ? (
              <img
                src={entry.photoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-cream-200" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
              {entry.fullName}
            </span>
            <span className="whitespace-nowrap font-display text-sm text-primary-900">
              {entry.points} {t("common.points")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StudentsTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: students, isLoading } = useStudentsByCircle(circleId);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  async function handleDownload() {
    if (!students?.length) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      await downloadStudentBarcodes(students, `circle-${circleId}-barcodes.zip`);
    } catch {
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Link
          to={`/app/circles/${circleId}/print`}
          className="inline-flex h-9 items-center rounded-lg border border-cream-200 bg-cream-50 px-3 text-xs font-medium text-ink-900"
        >
          {t("common.print")}
        </Link>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading || !students?.length}
          className="inline-flex h-9 items-center rounded-lg border border-gold-500/60 bg-gold-100 px-3 text-xs font-medium text-primary-900 transition-colors hover:bg-gold-100/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDownloading ? t("common.loading") : t("student.downloadBarcodes")}
        </button>
        <Link
          to={`/app/students/new?circleId=${circleId}`}
          className="inline-flex h-9 items-center rounded-lg bg-primary-900 px-3 text-xs font-medium text-cream-50"
        >
          {t("student.addStudent")}
        </Link>
      </div>

      {downloadError && (
        <p role="alert" className="text-xs text-danger">
          {t("student.downloadBarcodesError")}
        </p>
      )}

      <CircleLeaderboard circleId={circleId} />

      {isLoading && (
        <Card className="p-4">
          <SkeletonText lines={4} />
        </Card>
      )}

      {!isLoading && students?.length === 0 && (
        <EmptyState title={t("common.noResults")} />
      )}

      <div className="flex flex-col gap-2">
        {students?.map((student) => (
          <Link key={student._id} to={`/app/students/${student._id}`}>
            <Card className="flex items-center justify-between gap-3 p-3 hover:shadow-lg">
              <div className="flex min-w-0 items-center gap-3">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-cream-200" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {student.fullName}
                  </p>
                  <p className="text-xs text-ink-600">{student.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!student.isActive && (
                  <StatusChip tone="neutral" label={t("common.no")} />
                )}
                <span className="whitespace-nowrap font-display text-sm text-primary-900">
                  {student.totalPoints} {t("common.points")}
                </span>
                <WeeklyMemorizationButton
                  studentId={student._id}
                  fullName={student.fullName}
                />
                <WhatsAppButton phone={student.parentPhone} studentId={student._id} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
