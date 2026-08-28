import { useTranslation } from "react-i18next";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = "h-14 w-20" }: BrandMarkProps) {
  const { t } = useTranslation();

  return (
    <img
      src="/quran-logo.png"
      alt={t("app.title")}
      className={`object-contain ${className}`}
    />
  );
}
