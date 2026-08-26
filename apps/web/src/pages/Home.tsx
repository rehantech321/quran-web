import { useTranslation } from "react-i18next";

import { GirihPattern } from "@/components/ornament";

/** Placeholder landing page — replaced by the real login screen in Phase 9. */
export function Home() {
  const { t, i18n } = useTranslation();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-cream-100 p-6">
      <GirihPattern opacity={0.04} />
      <h1 className="relative font-display text-3xl text-primary-900">
        {t("app.title")}
      </h1>
      <p className="relative text-ink-600">{t("common.loading")}</p>
      <button
        type="button"
        className="relative rounded-md border border-cream-200 bg-cream-50 px-4 py-2 text-sm text-ink-900 shadow-card"
        onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
      >
        {t("common.language")}
      </button>
    </div>
  );
}
