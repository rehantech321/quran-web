import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** A persistent top banner while the browser reports no network connectivity (SPEC.md §7 screen 19). */
export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    function goOnline() {
      setIsOffline(false);
    }
    function goOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[200] bg-warning py-1.5 text-center text-xs text-cream-50"
    >
      {t("common.offline")}
    </div>
  );
}
