import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";

import { Card, Skeleton } from "@/components/ui";
import { useCircles } from "@/queries/circles";

/** Entry point for the "Scan" bottom-nav tab — jumps straight in if there's only one circle, otherwise asks which. */
export function ScanCirclePicker() {
  const { t } = useTranslation();
  const { data: circles, isLoading } = useCircles();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (circles?.length === 1) {
    return <Navigate to={`/app/circles/${circles[0]!._id}/scan`} replace />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <h1 className="font-display text-xl text-primary-900">{t("nav.scan")}</h1>
      {circles?.map((circle) => (
        <Link key={circle._id} to={`/app/circles/${circle._id}/scan`}>
          <Card className="p-4 hover:shadow-lg">{circle.name}</Card>
        </Link>
      ))}
    </div>
  );
}
