import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { createStudentSchema, updateStudentSchema } from "@halaqat/shared";

import { Button, Card, CardBody, Input, Select } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { isLikelyValidWhatsAppPhone, openWhatsAppChat } from "@/lib/whatsapp";
import { useOrganization } from "@/queries/organizations";
import { fetchStudentReport } from "@/queries/reports";
import {
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
        <StudentAccessCard studentId={studentId} accessSlug={student.accessSlug} />
      )}

      {isEditing && studentId && student && (
        <SendWhatsAppCard
          studentId={studentId}
          fullName={student.fullName}
          parentPhone={student.parentPhone}
        />
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

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow selecting the same file again later
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    try {
      await uploadPhoto.mutateAsync(file);
    } finally {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
    }
  }

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
            {uploadPhoto.isPending ? t("common.loading") : t("student.takePhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onFileSelected}
              disabled={uploadPhoto.isPending}
            />
          </label>
          {uploadPhoto.isError && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {getApiErrorMessage(uploadPhoto.error, t("common.error"))}
            </p>
          )}
        </div>
      </div>
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

type ReportPeriod = "daily" | "weekly" | "monthly";

const PERIOD_LABEL_KEYS: Record<ReportPeriod, string> = {
  daily: "whatsapp.periodDaily",
  weekly: "whatsapp.periodWeekly",
  monthly: "whatsapp.periodMonthly",
};

function periodToRange(period: ReportPeriod): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

function SendWhatsAppCard({
  studentId,
  fullName,
  parentPhone,
}: {
  studentId: string;
  fullName: string;
  parentPhone: string;
}) {
  const { t } = useTranslation();
  const { data: org } = useOrganization();
  const [customMessage, setCustomMessage] = useState("");
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSendCustomMessage() {
    setError(null);
    const sent = openWhatsAppChat(parentPhone, customMessage);
    if (!sent) setError(t("whatsapp.invalidPhone"));
  }

  async function onSendReport() {
    setError(null);
    if (!isLikelyValidWhatsAppPhone(parentPhone)) {
      setError(t("whatsapp.invalidPhone"));
      return;
    }
    setIsSendingReport(true);
    try {
      const range = periodToRange(period);
      const report = await fetchStudentReport(studentId, range);
      const lines = [
        t("whatsapp.reportGreeting", { name: fullName }),
        `${t("whatsapp.reportPeriod")}: ${t(PERIOD_LABEL_KEYS[period])}`,
        "",
      ];
      if (report.stats.attendanceRate !== null) {
        lines.push(`${t("whatsapp.attendanceRate")}: ${report.stats.attendanceRate}%`);
      }
      if (report.stats.avgGrade !== null) {
        lines.push(`${t("whatsapp.avgGrade")}: ${report.stats.avgGrade}`);
      }
      if (report.stats.questionAccuracy !== null) {
        lines.push(
          `${t("whatsapp.questionAccuracy")}: ${report.stats.questionAccuracy}%`,
        );
      }
      lines.push(`${t("whatsapp.tasksApproved")}: ${report.stats.tasksApproved}`);
      lines.push(`${t("whatsapp.pointsEarned")}: ${report.stats.periodPoints}`);
      if (org?.name) {
        lines.push("", t("whatsapp.reportFooter", { orgName: org.name }));
      }
      openWhatsAppChat(parentPhone, lines.join("\n"));
    } catch {
      setError(t("whatsapp.reportFetchError"));
    } finally {
      setIsSendingReport(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink-900">{t("whatsapp.title")}</h2>
      <div className="flex flex-col gap-3">
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
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-cream-200 pt-3">
          <Select
            label={t("whatsapp.reportPeriod")}
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="w-32"
          >
            <option value="daily">{t("whatsapp.periodDaily")}</option>
            <option value="weekly">{t("whatsapp.periodWeekly")}</option>
            <option value="monthly">{t("whatsapp.periodMonthly")}</option>
          </Select>
          <Button size="sm" onClick={onSendReport} disabled={isSendingReport}>
            {isSendingReport ? t("whatsapp.sendingReport") : t("whatsapp.sendReport")}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
