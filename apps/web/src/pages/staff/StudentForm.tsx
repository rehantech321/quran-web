import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { createStudentSchema, updateStudentSchema } from "@halaqat/shared";

import { Button, Card, CardBody, Input } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  useCreateStudent,
  useDeleteStudent,
  useRegenerateStudentSlug,
  useStudent,
  useStudentQrObjectUrl,
  useUpdateStudent,
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
            photoUrl: student.photoUrl,
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
              label={`${t("student.photoUrl")} (${t("common.optional")})`}
              placeholder="https://..."
              {...register("photoUrl")}
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
        <StudentAccessCard studentId={studentId} accessSlug={student.accessSlug} />
      )}

      {isEditing && (
        <Button variant="danger" onClick={onDelete} disabled={deleteStudent.isPending}>
          {t("common.delete")}
        </Button>
      )}
    </div>
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
