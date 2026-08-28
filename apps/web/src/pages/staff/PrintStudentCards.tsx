import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { MihrabArch } from "@/components/ornament";
import { Button, Skeleton } from "@/components/ui";
import { useBlobObjectUrls } from "@/hooks/useBlobObjectUrls";
import { useOrganization } from "@/queries/organizations";
import { useStudentsByCircle } from "@/queries/students";
import { downloadStudentBarcodes } from "@/utils/downloadStudentBarcodes";

/** Printable A4 sheet of student QR cards — SPEC.md §7 screen 18. Standalone route (no app chrome to fight print CSS). */
export function PrintStudentCards() {
  const { t } = useTranslation();
  const { circleId } = useParams<{ circleId: string }>();
  const { data: students, isLoading } = useStudentsByCircle(circleId);
  const { data: org } = useOrganization();
  const qrUrls = useBlobObjectUrls(
    (id) => `/students/${id}/qr.png`,
    (students ?? []).map((s) => s._id),
  );
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await downloadStudentBarcodes(students ?? [], `circle-${circleId}-barcodes.zip`);
    } finally {
      setIsDownloading(false);
    }
  }

  if (isLoading || !students) {
    return (
      <div className="p-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="font-display text-xl text-primary-900">
          {t("student.printCard")}
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleDownload} disabled={isDownloading || !students.length}>
            {isDownloading ? t("common.loading") : t("student.downloadBarcodes")}
          </Button>
          <Button onClick={() => window.print()}>{t("common.print")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        {students.map((student) => (
          <div
            key={student._id}
            className="print-card flex flex-col items-center gap-2 rounded-xl border-2 border-gold-500/40 bg-cream-50 p-4 text-center"
          >
            <div className="flex items-center gap-1 text-xs text-primary-900">
              <MihrabArch variant="cap" className="h-4 w-6" />
              {org?.name}
            </div>
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-cream-200" />
            )}
            <p className="font-display text-base text-ink-900">{student.fullName}</p>
            {qrUrls.get(student._id) ? (
              <img src={qrUrls.get(student._id)} alt="QR" className="h-28 w-28" />
            ) : (
              <Skeleton className="h-28 w-28" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
