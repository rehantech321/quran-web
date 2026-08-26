import { useTranslation } from "react-i18next";

import { GoldRule } from "@/components/ornament";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export interface ErrorStateProps {
  /** A pre-translated, user-safe message (e.g. from getApiErrorMessage) — never a raw thrown error/stack. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** A calm error state — the raw error string is never shown to the user (SPEC.md §7 screen 19). */
export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-danger/20 bg-cream-50 p-8 text-center",
        className,
      )}
    >
      <p className="font-display text-lg text-danger">{message ?? t("common.error")}</p>
      <GoldRule className="w-32" />
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
