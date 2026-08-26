import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { GirihPattern, MihrabArch } from "@/components/ornament";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-cream-100 p-6 text-center">
      <GirihPattern opacity={0.05} />
      <MihrabArch variant="cap" className="relative h-16 w-28 text-primary-900" />
      <p className="relative font-display text-2xl text-primary-900">
        {t("common.pageNotFound")}
      </p>
      <Link to="/" className="relative text-sm text-primary-700 hover:underline">
        {t("common.backHome")}
      </Link>
    </div>
  );
}
