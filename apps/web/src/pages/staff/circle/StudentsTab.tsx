import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Card, EmptyState, SkeletonText, StatusChip } from "@/components/ui";
import { useStudentsByCircle } from "@/queries/students";
import { downloadStudentBarcodes } from "@/utils/downloadStudentBarcodes";

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
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
