import { useTranslation } from "react-i18next";

import { SkeletonText, StatusChip } from "@/components/ui";
import { useMyPointsHistory, useMyProfile } from "@/queries/studentMe";
import type { PointsLedgerEntry } from "@/types/api";

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupByMonth(entries: PointsLedgerEntry[]): [string, PointsLedgerEntry[]][] {
  const map = new Map<string, PointsLedgerEntry[]>();
  for (const entry of entries) {
    const key = monthKey(entry.occurredAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return [...map.entries()];
}

export function PointsHistory() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useMyProfile();
  const { data, isLoading } = useMyPointsHistory();

  const groups = data ? groupByMonth(data.entries) : [];
  const monthFormatter = new Intl.DateTimeFormat(i18n.language === "ar" ? "ar" : "en", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-32">
      <h1 className="font-display text-2xl text-primary-900">
        {t("pointsHistory.title")}
      </h1>

      {isLoading && <SkeletonText lines={6} />}

      {!isLoading && data?.entries.length === 0 && (
        <p className="text-center text-sm text-ink-600">{t("pointsHistory.empty")}</p>
      )}

      {groups.map(([key, entries]) => (
        <div key={key} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase text-ink-400">
            {monthFormatter.format(new Date(entries[0]!.occurredAt))}
          </p>
          {entries.map((entry) => (
            <div
              key={entry._id}
              className="flex items-center justify-between rounded-lg border border-cream-200 bg-cream-50 px-3 py-2.5"
            >
              <div>
                <p className="text-sm text-ink-900">
                  {t(entry.reason, entry.reasonParams)}
                </p>
                <p className="text-xs text-ink-400">
                  {new Date(entry.occurredAt).toLocaleDateString(i18n.language)}
                </p>
              </div>
              <StatusChip
                tone={entry.points >= 0 ? "success" : "danger"}
                label={`${entry.points >= 0 ? "+" : ""}${entry.points}`}
              />
            </div>
          ))}
        </div>
      ))}

      {profile && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-cream-200 bg-cream-50/95 px-4 py-3 text-center backdrop-blur">
          <span className="text-xs text-ink-600">{t("pointsHistory.total")}: </span>
          <span className="font-display text-lg text-primary-900">
            {profile.totalPoints}
          </span>
        </div>
      )}
    </div>
  );
}
