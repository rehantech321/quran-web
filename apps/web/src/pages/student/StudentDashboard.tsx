import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CornerArabesque, MihrabArch } from "@/components/ornament";
import { Skeleton } from "@/components/ui";
import { useMyProfile } from "@/queries/studentMe";

const TILES = [
  {
    key: "attendance",
    to: "/student/points-history",
    labelKey: "studentDashboard.attendanceSubtotal",
  },
  {
    key: "grades",
    to: "/student/points-history",
    labelKey: "studentDashboard.gradesSubtotal",
  },
  {
    key: "questions",
    to: "/student/question",
    labelKey: "studentDashboard.questionsSubtotal",
  },
  { key: "tasks", to: "/student/tasks", labelKey: "studentDashboard.tasksSubtotal" },
] as const;

export function StudentDashboard() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-md p-4 pb-24">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-50 shadow-card">
        <MihrabArch variant="cap" className="h-16 w-full text-primary-900" />
        <div className="relative flex flex-col items-center gap-2 px-4 pb-6 pt-2">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              className="-mt-8 h-20 w-20 rounded-full border-4 border-cream-50 object-cover shadow"
            />
          ) : (
            <div className="-mt-8 h-20 w-20 rounded-full border-4 border-cream-50 bg-cream-200 shadow" />
          )}
          <p className="font-display text-xl text-primary-900">{profile.fullName}</p>
          {profile.circle && (
            <p className="text-sm text-ink-600">
              {t("studentDashboard.circle")}: {profile.circle.name}
            </p>
          )}

          <div className="relative mt-2 w-full rounded-xl bg-primary-900/5 py-4 text-center">
            <CornerArabesque corner="top-start" />
            <CornerArabesque corner="bottom-end" />
            <p className="font-display text-4xl text-primary-900">
              {profile.totalPoints}
            </p>
            <p className="text-xs text-ink-600">{t("studentDashboard.totalPoints")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((tile) => (
          <Link
            key={tile.key}
            to={tile.to}
            className="rounded-xl border border-cream-200 bg-cream-50 p-4 text-center shadow-card"
          >
            <p className="font-display text-2xl text-primary-900">
              {profile.pointsBreakdown[tile.key as keyof typeof profile.pointsBreakdown]}
            </p>
            <p className="mt-1 text-xs text-ink-600">{t(tile.labelKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
