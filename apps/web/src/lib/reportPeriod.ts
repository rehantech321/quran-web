export type ReportPeriod = "daily" | "weekly" | "monthly";

export const PERIOD_LABEL_KEYS: Record<ReportPeriod, string> = {
  daily: "whatsapp.periodDaily",
  weekly: "whatsapp.periodWeekly",
  monthly: "whatsapp.periodMonthly",
};

export function periodToRange(period: ReportPeriod): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from, to };
}
