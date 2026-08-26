import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import arCommon from "./locales/ar/common.json";
import enCommon from "./locales/en/common.json";

export const RTL_LANGUAGES = ["ar"];

export function applyDocumentDirection(language: string) {
  const dir = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = language;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { common: arCommon },
      en: { common: enCommon },
    },
    fallbackLng: "ar",
    supportedLngs: ["ar", "en"],
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "halaqat_language",
    },
  });

i18n.on("languageChanged", applyDocumentDirection);
applyDocumentDirection(i18n.resolvedLanguage ?? "ar");

export default i18n;
