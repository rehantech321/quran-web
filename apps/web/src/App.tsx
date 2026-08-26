import { useTranslation } from "react-i18next";

function App() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 p-6">
      <h1 className="font-display text-3xl text-primary-900">{t("app.title")}</h1>
      <p className="text-ink-600">{t("common.loading")}</p>
      <button
        type="button"
        className="rounded-md border border-cream-200 bg-cream-50 px-4 py-2 text-sm text-ink-900 shadow-card"
        onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
      >
        {t("common.language")}
      </button>
    </div>
  );
}

export default App;
