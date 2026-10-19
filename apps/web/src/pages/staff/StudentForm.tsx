import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { createStudentSchema, updateStudentSchema } from "@halaqat/shared";

import { Button, Card, CardBody, Input, Select, StatusChip } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { compressImageForUpload } from "@/lib/imageCompression";
import { EVALUATION_LABEL_KEYS, EVALUATION_TONES } from "@/lib/memorizationEvaluation";
import { buildParentWeeklyReportMessage } from "@/lib/parentReportMessage";
import { periodToRange, type ReportPeriod } from "@/lib/reportPeriod";
import { isLikelyValidWhatsAppPhone, openWhatsAppChat } from "@/lib/whatsapp";
import { useOrganization } from "@/queries/organizations";
import { fetchParentWeeklyReport, type ParentWeeklyReport } from "@/queries/reports";
import {
  useAddManualPoints,
  useCreateStudent,
  useDeleteStudent,
  useRegenerateStudentSlug,
  useStudent,
  useStudentQrObjectUrl,
  useUpdateStudent,
  useUploadStudentPhoto,
} from "@/queries/students";

type FormValues = z.infer<typeof createStudentSchema>;

export function StudentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(studentId) && studentId !== "new";
  const circleIdFromQuery = searchParams.get("circleId") ?? "";

  const { data: student } = useStudent(isEditing ? studentId : undefined);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent(studentId ?? "");
  const deleteStudent = useDeleteStudent();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEditing ? updateStudentSchema : createStudentSchema),
    values:
      isEditing && student
        ? {
            circleId: student.circleId,
            fullName: student.fullName,
            parentPhone: student.parentPhone,
            studentPhone: student.studentPhone,
            level: student.level,
            notes: student.notes,
          }
        : { circleId: circleIdFromQuery, fullName: "", parentPhone: "" },
  });

  const mutation = isEditing ? updateStudent : createStudent;

  async function onSubmit(values: FormValues) {
    if (isEditing) {
      await updateStudent.mutateAsync(values);
    } else {
      const created = await createStudent.mutateAsync(values);
      navigate(`/app/students/${created._id}`, { replace: true });
    }
  }

  async function onDelete() {
    if (!studentId || !window.confirm(t("student.deleteConfirm"))) return;
    await deleteStudent.mutateAsync(studentId);
    navigate(`/app/circles/${student?.circleId}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <Link
        to={student ? `/app/circles/${student.circleId}` : "/app/circles"}
        className="text-xs text-ink-600 hover:underline"
      >
        &rarr; {t("common.back")}
      </Link>
      <h1 className="font-display text-2xl text-primary-900">
        {isEditing ? t("student.editStudent") : t("student.addStudent")}
      </h1>

      <Card>
        <CardBody>
          <form
            className="flex flex-col gap-3"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Input
              label={t("student.fullName")}
              error={errors.fullName?.message}
              {...register("fullName")}
            />
            <Input
              label={t("student.parentPhone")}
              hint={t("student.parentPhoneHint")}
              error={errors.parentPhone?.message}
              {...register("parentPhone")}
            />
            <Input
              label={`${t("student.studentPhone")} (${t("common.optional")})`}
              {...register("studentPhone")}
            />
            <Input
              label={`${t("student.level")} (${t("common.optional")})`}
              {...register("level")}
            />
            <Input
              label={`${t("student.notes")} (${t("common.optional")})`}
              {...register("notes")}
            />
            {mutation.isError && (
              <p role="alert" className="text-sm text-danger">
                {getApiErrorMessage(mutation.error, t("common.error"))}
              </p>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {t("common.save")}
            </Button>
          </form>
        </CardBody>
      </Card>

      {isEditing && studentId && student && (
        <StudentPhotoCard
          studentId={studentId}
          photoUrl={student.photoUrl}
          fullName={student.fullName}
        />
      )}

      {isEditing && studentId && student && (
        <AdjustPointsCard studentId={studentId} totalPoints={student.totalPoints} />
      )}

      {isEditing && studentId && student && (
        <StudentAccessCard studentId={studentId} accessSlug={student.accessSlug} />
      )}

      {isEditing && studentId && student && (
        <SendWhatsAppCard parentPhone={student.parentPhone} />
      )}

      {isEditing && studentId && student && (
        <ParentWeeklyReportCard studentId={studentId} parentPhone={student.parentPhone} />
      )}

      {isEditing && (
        <Button variant="danger" onClick={onDelete} disabled={deleteStudent.isPending}>
          {t("common.delete")}
        </Button>
      )}
    </div>
  );
}

function StudentPhotoCard({
  studentId,
  photoUrl,
  fullName,
}: {
  studentId: string;
  photoUrl?: string;
  fullName: string;
}) {
  const { t } = useTranslation();
  const uploadPhoto = useUploadStudentPhoto(studentId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    e.target.value = ""; // allow selecting the same file again later
    if (!rawFile) return;

    // A phone camera photo straight off the sensor is routinely 3-8MB —
    // slow (sometimes unusably so on a weak mobile connection) to upload,
    // and far more than a headshot needs. Shrinking it in the browser
    // first turns "upload times out / silently fails on mobile data" into
    // a sub-second, sub-500KB request. Falls back to the original file if
    // compression can't run for some reason, so it never blocks an upload
    // that would otherwise have worked.
    setIsCompressing(true);
    const file = await compressImageForUpload(rawFile);
    setIsCompressing(false);

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    try {
      await uploadPhoto.mutateAsync(file);
    } finally {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
    }
  }

  const isBusy = isCompressing || uploadPhoto.isPending;
  const displayUrl = previewUrl ?? photoUrl;

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-900">{t("student.photo")}</h2>
      <div className="flex items-center gap-4">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={fullName}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-full bg-cream-200" />
        )}
        <div className="min-w-0 flex-1">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-primary-900 px-4 text-sm font-medium text-cream-50">
            {isBusy ? t("common.loading") : t("student.takePhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onFileSelected}
              disabled={isBusy}
            />
          </label>
          {uploadPhoto.isError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {getApiErrorMessage(uploadPhoto.error, t("common.error"))}{" "}
              {describeUploadError(uploadPhoto.error)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * A bare "something went wrong" was hard to diagnose from a phone with no
 * dev tools — appending the HTTP status (or "network" for a request that
 * never got a response at all, e.g. a timeout on a slow connection) turns
 * the next bug report into something actionable without needing screen
 * sharing or server log access.
 */
function describeUploadError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response ? `(${error.response.status})` : "(network)";
  }
  return "";
}

/**
 * A manual points adjustment — for bonuses, corrections, anything that
 * doesn't fit attendance/grades/questions/tasks. Always additive (a signed
 * delta, never an absolute total to set): the points engine is an
 * append-only ledger (SPEC.md §5), so "set this student's points to X" isn't
 * an operation it supports — only "record that N points were awarded (or
 * deducted) just now, with a reason," same as every other point source.
 */
function AdjustPointsCard({
  studentId,
  totalPoints,
}: {
  studentId: string;
  totalPoints: number;
}) {
  const { t } = useTranslation();
  const addPoints = useAddManualPoints(studentId);
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount === "" || amount === 0 || !reason.trim()) return;
    await addPoints.mutateAsync({ points: Number(amount), reason: reason.trim() });
    setAmount("");
    setReason("");
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold text-ink-900">
        {t("student.adjustPoints")}
      </h2>
      <p className="mb-3 text-xs text-ink-600">
        {t("student.totalPoints")}: {totalPoints}
      </p>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("student.pointsAmount")}
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            hint={t("student.pointsAmountHint")}
          />
          <Input
            label={t("student.pointsReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {addPoints.isError && (
          <p role="alert" className="text-sm text-danger">
            {getApiErrorMessage(addPoints.error, t("common.error"))}
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={
            addPoints.isPending || amount === "" || amount === 0 || !reason.trim()
          }
        >
          {addPoints.isPending ? t("common.loading") : t("common.add")}
        </Button>
      </form>
    </Card>
  );
}

function StudentAccessCard({
  studentId,
  accessSlug,
}: {
  studentId: string;
  accessSlug: string;
}) {
  const { t } = useTranslation();
  const qrUrl = useStudentQrObjectUrl(studentId);
  const regenerate = useRegenerateStudentSlug(studentId);
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/student/${accessSlug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onRegenerate() {
    if (window.confirm(t("student.regenerateConfirm"))) {
      await regenerate.mutateAsync();
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-900">
        {t("student.accessLink")}
      </h2>
      <div className="flex items-center gap-4">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="QR"
            className="h-24 w-24 shrink-0 rounded-lg border border-cream-200"
          />
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-lg bg-cream-200" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="truncate rounded-md bg-cream-100 px-2 py-1.5 text-xs text-ink-600 ltr:text-left rtl:text-right"
            dir="ltr"
          >
            {link}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={copyLink}>
              {copied ? t("common.copied") : t("student.copyLink")}
            </Button>
            {typeof navigator.share === "function" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.share({ url: link })}
              >
                {t("student.shareLink")}
              </Button>
            )}
            {qrUrl && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => window.open(qrUrl, "_blank")}
              >
                {t("student.printCard")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              disabled={regenerate.isPending}
            >
              {t("student.regenerateLink")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * A free-form message the supervisor types themselves — distinct from
 * `ParentWeeklyReportCard` below, which builds a structured, data-backed
 * report. This card is for anything that doesn't fit that shape (a quick
 * note, a reminder) and has no period/report logic of its own.
 */
function SendWhatsAppCard({ parentPhone }: { parentPhone: string }) {
  const { t } = useTranslation();
  const [customMessage, setCustomMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSendCustomMessage() {
    setError(null);
    const sent = openWhatsAppChat(parentPhone, customMessage);
    if (!sent) setError(t("whatsapp.invalidPhone"));
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-900">{t("whatsapp.title")}</h2>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="whatsapp-custom-message"
          className="text-sm font-medium text-ink-900"
        >
          {t("whatsapp.customMessageLabel")}
        </label>
        <textarea
          id="whatsapp-custom-message"
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder={t("whatsapp.customMessagePlaceholder")}
          rows={3}
          className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2 text-start text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={onSendCustomMessage}
          disabled={!customMessage.trim()}
        >
          {t("whatsapp.sendMessage")}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * The parent-facing report (originally "Weekly Report for Parents", now
 * period-selectable like the old periodic WhatsApp report it replaced):
 * attendance as actual day counts (never a percentage — explicitly asked
 * for), correct weekly-question answers, completed memorization/revision
 * portions, and points earned within the chosen period. Viewable inline in
 * the app and sendable to the parent via WhatsApp in the exact wording the
 * app owner specified.
 */
function ParentWeeklyReportCard({
  studentId,
  parentPhone,
}: {
  studentId: string;
  parentPhone: string;
}) {
  const { t, i18n } = useTranslation();
  const { data: org } = useOrganization();
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [report, setReport] = useState<ParentWeeklyReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(): Promise<ParentWeeklyReport | null> {
    setIsLoading(true);
    setError(null);
    try {
      const fresh = await fetchParentWeeklyReport(studentId, periodToRange(period));
      setReport(fresh);
      return fresh;
    } catch {
      setError(t("parentReport.reportFetchError"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function onToggleView() {
    // Always reload on open — the previously-shown report may be for a
    // different period if the supervisor changed the selector in between.
    if (!showReport) await loadReport();
    setShowReport((prev) => !prev);
  }

  async function onSendWhatsApp() {
    if (!isLikelyValidWhatsAppPhone(parentPhone)) {
      setError(t("whatsapp.invalidPhone"));
      return;
    }
    const fresh = await loadReport();
    if (!fresh) return;
    const message = buildParentWeeklyReportMessage(t, fresh, period, org?.name);
    openWhatsAppChat(parentPhone, message);
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-900">
        {t("parentReport.title")}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label={t("whatsapp.reportPeriod")}
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value as ReportPeriod);
            setShowReport(false);
          }}
          className="w-32"
        >
          <option value="daily">{t("whatsapp.periodDaily")}</option>
          <option value="weekly">{t("whatsapp.periodWeekly")}</option>
          <option value="monthly">{t("whatsapp.periodMonthly")}</option>
        </Select>
        <Button size="sm" variant="secondary" onClick={onToggleView} disabled={isLoading}>
          {isLoading
            ? t("parentReport.preparingReport")
            : showReport
              ? t("parentReport.hideReport")
              : t("parentReport.viewReport")}
        </Button>
        <Button size="sm" onClick={onSendWhatsApp} disabled={isLoading}>
          {isLoading ? t("parentReport.preparingReport") : t("parentReport.sendReport")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      {showReport && report && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-ink-900">
          <p className="text-xs text-ink-600">
            {new Date(report.range.from).toLocaleDateString(i18n.language)}
            {" – "}
            {new Date(report.range.to).toLocaleDateString(i18n.language)}
          </p>

          <div className="rounded-lg border border-cream-200 bg-cream-50 p-3">
            {/* A late arrival still attended — merge it into "present" the
                same way `attendanceRate` does elsewhere, so a student who
                was late every day doesn't read as "never attended". */}
            <p className="text-ink-700">
              {t("parentReport.daysPresent")}:{" "}
              {report.attendance.present + report.attendance.late}
            </p>
            <p className="text-ink-700">
              {t("parentReport.daysAbsent")}: {report.attendance.absent}
            </p>
            <p className="text-ink-700">
              {t("parentReport.correctAnswers")}: {report.correctAnswers}
            </p>
          </div>

          <ParentReportSection title={t("parentReport.completedTasksHeading")}>
            {report.newMemorization.length === 0 && report.revision.length === 0 ? (
              <p className="text-ink-500">{t("parentReport.noCompletedTasks")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {report.newMemorization.map((e, i) => (
                  <li
                    key={`new-${i}`}
                    className="flex flex-wrap items-center gap-2 text-ink-700"
                  >
                    <span>
                      {t("parentReport.memorizationLabel")}:{" "}
                      {t("parentReport.ayahRangeLine", {
                        surah: e.surahName,
                        from: e.fromAyah,
                        to: e.toAyah,
                      })}
                    </span>
                    {e.evaluation && (
                      <StatusChip
                        tone={EVALUATION_TONES[e.evaluation]}
                        label={t(EVALUATION_LABEL_KEYS[e.evaluation])}
                      />
                    )}
                  </li>
                ))}
                {report.revision.map((e, i) => (
                  <li
                    key={`rev-${i}`}
                    className="flex flex-wrap items-center gap-2 text-ink-700"
                  >
                    <span>
                      {t("parentReport.revisionLabel")}:{" "}
                      {t("parentReport.ayahRangeLine", {
                        surah: e.surahName,
                        from: e.fromAyah,
                        to: e.toAyah,
                      })}
                    </span>
                    {e.evaluation && (
                      <StatusChip
                        tone={EVALUATION_TONES[e.evaluation]}
                        label={t(EVALUATION_LABEL_KEYS[e.evaluation])}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ParentReportSection>

          <p className="text-ink-900">
            {t("parentReport.pointsEarned")}: {report.periodPoints}
          </p>
        </div>
      )}
    </Card>
  );
}

function ParentReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-cream-200 bg-cream-50 p-3">
      <h3 className="mb-1.5 text-xs font-semibold text-primary-800">{title}</h3>
      {children}
    </div>
  );
}
