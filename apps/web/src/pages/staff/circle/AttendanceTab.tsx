import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { AttendanceStatus } from "@halaqat/shared";

import { Button, Card, Modal, SkeletonText, StatusChip } from "@/components/ui";
import {
  useAttendanceRoster,
  useCloseSession,
  useManualAttendance,
  useUpdateAttendance,
} from "@/queries/attendance";
import { cn } from "@/utils/cn";

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "excused"];

const STATUS_TONE: Record<
  AttendanceStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "neutral",
};

export function AttendanceTab({ circleId }: { circleId: string }) {
  const { t } = useTranslation();
  const { data: roster, isLoading } = useAttendanceRoster(circleId);
  const manualAttendance = useManualAttendance(circleId);
  const updateAttendance = useUpdateAttendance(circleId);
  const closeSession = useCloseSession(circleId);
  const [confirmClose, setConfirmClose] = useState(false);

  const unrecordedCount = roster?.filter((r) => r.status === "not_recorded").length ?? 0;

  function setStatus(
    entry: NonNullable<typeof roster>[number],
    status: AttendanceStatus,
  ) {
    if (entry.status === "not_recorded") {
      manualAttendance.mutate({
        studentId: entry.studentId,
        sessionDate: new Date().toISOString(),
        status,
      });
    } else if (entry.attendanceRecordId) {
      updateAttendance.mutate({ id: entry.attendanceRecordId, status });
    }
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <SkeletonText lines={5} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={unrecordedCount === 0}
          onClick={() => setConfirmClose(true)}
        >
          {t("attendance.closeSession")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roster?.map((entry) => (
          <Card
            key={entry.studentId}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink-900">{entry.fullName}</span>
              {entry.status !== "not_recorded" && (
                <StatusChip
                  tone={STATUS_TONE[entry.status]}
                  label={t(`attendance.${entry.status}`)}
                />
              )}
            </div>
            <div className="flex gap-1" role="group" aria-label={entry.fullName}>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatus(entry, status)}
                  className={cn(
                    "min-h-9 rounded-md border px-2 text-xs transition-colors",
                    entry.status === status
                      ? "border-primary-900 bg-primary-900 text-cream-50"
                      : "border-cream-200 bg-cream-50 text-ink-600 hover:bg-cream-200",
                  )}
                >
                  {t(`attendance.${status}`)}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t("attendance.closeSession")}
      >
        <p className="mb-4 text-sm text-ink-600">
          {t("attendance.closeSessionConfirm", { count: unrecordedCount })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClose(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              closeSession.mutate(undefined);
              setConfirmClose(false);
            }}
          >
            {t("common.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
