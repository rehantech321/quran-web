import { useTranslation } from "react-i18next";

import { Card, CardBody, Skeleton } from "@/components/ui";
import { useMyProfile } from "@/queries/studentMe";

export function Profile() {
  const { t, i18n } = useTranslation();
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-md p-4 pb-24">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-2xl text-primary-900">{t("profile.title")}</h1>

      <Card>
        <CardBody className="flex flex-col items-center gap-3 text-center">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-cream-200" />
          )}
          <p className="font-display text-xl text-primary-900">{profile.fullName}</p>
          <div className="w-full divide-y divide-cream-200 text-sm">
            {profile.circle && (
              <div className="flex justify-between py-2">
                <span className="text-ink-600">{t("student.circle")}</span>
                <span className="text-ink-900">{profile.circle.name}</span>
              </div>
            )}
            {profile.supervisorName && (
              <div className="flex justify-between py-2">
                <span className="text-ink-600">{t("profile.supervisor")}</span>
                <span className="text-ink-900">{profile.supervisorName}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-ink-600">{t("student.totalPoints")}</span>
              <span className="font-display text-primary-900">{profile.totalPoints}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <button
        type="button"
        onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
        className="rounded-lg border border-cream-200 bg-cream-50 px-4 py-2.5 text-sm text-ink-900"
      >
        {t("common.language")}
      </button>
    </div>
  );
}
