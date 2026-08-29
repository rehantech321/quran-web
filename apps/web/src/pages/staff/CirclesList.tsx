import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";

import { createCircleSchema } from "@halaqat/shared";

import { CornerArabesque, GirihPattern } from "@/components/ornament";
import {
  Button,
  Card,
  Input,
  Modal,
  ProgressRing,
  Select,
  SkeletonCard,
} from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useCircles, useCreateCircle } from "@/queries/circles";
import { useCircleChampions } from "@/queries/reports";
import { useStaff } from "@/queries/users";
import { useAuthStore } from "@/store/authStore";
import { nextSessionLabel } from "@/utils/schedule";

const DAY_KEYS = [0, 1, 2, 3, 4, 5, 6];

export function CirclesList() {
  const { t } = useTranslation();
  const { data: circles, isLoading } = useCircles();
  const user = useAuthStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const canManageCircles = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-primary-900">{t("circles.title")}</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/app/approvals"
            className="text-xs font-medium text-primary-700 hover:underline"
          >
            {t("tasks.pendingApprovals")}
          </Link>
          {canManageCircles && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="hidden sm:inline-flex"
            >
              {t("circles.addNew")}
            </Button>
          )}
        </div>
      </div>

      <ChampionsWidget />

      {isLoading && (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && circles?.length === 0 && (
        <Card className="relative overflow-hidden p-8 text-center">
          <GirihPattern opacity={0.04} />
          <p className="relative text-ink-600">{t("circles.noCircles")}</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {circles?.map((circle) => (
          <Link key={circle._id} to={`/app/circles/${circle._id}`}>
            <Card className="flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-lg">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg text-primary-900">
                  {circle.name}
                </h2>
                <p className="text-sm text-ink-600">
                  {t("circles.studentCount", { count: circle.studentCount })}
                </p>
                {circle.schedule.days.length > 0 && (
                  <p className="text-xs text-ink-400">
                    {t("circles.nextSession")}: {nextSessionLabel(circle.schedule, t)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <ProgressRing
                  value={circle.todayAttendance.recorded}
                  max={circle.todayAttendance.total}
                />
                <span className="text-[10px] text-ink-400">
                  {t("circles.todayAttendance")}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {canManageCircles && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-2xl text-primary-950 shadow-lg sm:hidden"
          aria-label={t("circles.addNew")}
        >
          +
        </button>
      )}

      <CreateCircleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/** "Champions of the Circles" — this week's top student per circle, front and center on the staff home screen. */
function ChampionsWidget() {
  const { t } = useTranslation();
  const { data: champions, isLoading } = useCircleChampions("week");
  const withChampion = champions?.filter((c) => c.champion) ?? [];

  if (isLoading || withChampion.length === 0) return null;

  return (
    <Card className="relative overflow-hidden p-4">
      <CornerArabesque corner="top-start" />
      <div className="relative mb-3">
        <h2 className="font-display text-lg text-primary-900">{t("champions.title")}</h2>
        <p className="text-xs text-ink-600">{t("champions.subtitle")}</p>
      </div>
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3">
        {withChampion.map(({ circleId, circleName, champion }) => (
          <div
            key={circleId}
            className="flex flex-col items-center gap-1 rounded-xl border border-gold-400/30 bg-cream-50 p-3 text-center"
          >
            {champion!.photoUrl ? (
              <img
                src={champion!.photoUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-gold-400"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-cream-200 ring-2 ring-gold-400" />
            )}
            <p className="max-w-full truncate text-[11px] text-ink-600">{circleName}</p>
            <p className="max-w-full truncate text-sm font-medium text-ink-900">
              {champion!.fullName}
            </p>
            <p className="font-display text-sm text-primary-900">
              {champion!.points} {t("common.points")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

type CreateCircleFormValues = z.infer<typeof createCircleSchema>;

function CreateCircleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: staff } = useStaff();
  const createCircle = useCreateCircle();
  const supervisors = staff?.filter((s) => s.role === "supervisor") ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCircleFormValues>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: { schedule: { days: [], startTime: "19:45", lateAfter: "20:15" } },
  });
  const selectedDays = watch("schedule.days") ?? [];

  function toggleDay(day: number) {
    setValue(
      "schedule.days",
      selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort(),
    );
  }

  async function onSubmit(values: CreateCircleFormValues) {
    await createCircle.mutateAsync(values);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("circles.createCircle")}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label={t("circles.name")}
          error={errors.name?.message}
          {...register("name")}
        />
        <Select
          label={t("circles.supervisor")}
          error={errors.supervisorId?.message}
          {...register("supervisorId")}
        >
          <option value="">—</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-900">{t("circles.days")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DAY_KEYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`min-h-9 rounded-md border px-2.5 text-xs ${
                  selectedDays.includes(day)
                    ? "border-primary-900 bg-primary-900 text-cream-50"
                    : "border-cream-200 bg-cream-50 text-ink-600"
                }`}
              >
                {t(`days.${day}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("circles.startTime")}
            type="time"
            {...register("schedule.startTime")}
          />
          <Input
            label={t("circles.lateAfter")}
            type="time"
            {...register("schedule.lateAfter")}
          />
        </div>
        {createCircle.isError && (
          <p role="alert" className="text-sm text-danger">
            {getApiErrorMessage(createCircle.error, t("common.error"))}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={createCircle.isPending}>
            {t("circles.createCircle")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
