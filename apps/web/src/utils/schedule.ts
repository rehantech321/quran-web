import type { TFunction } from "i18next";

/** The next upcoming session's weekday + time for a circle's recurring schedule, e.g. "الأحد 19:45". */
export function nextSessionLabel(
  schedule: { days: number[]; startTime: string },
  t: TFunction,
): string {
  if (schedule.days.length === 0) return "";
  const now = new Date();
  const todayDow = now.getDay();
  const [h, m] = schedule.startTime.split(":").map(Number);

  const sorted = [...schedule.days].sort((a, b) => a - b);
  let bestOffset = 8;
  for (const day of sorted) {
    let offset = (day - todayDow + 7) % 7;
    if (offset === 0) {
      const startsAt = new Date(now);
      startsAt.setHours(h ?? 0, m ?? 0, 0, 0);
      if (startsAt.getTime() <= now.getTime()) offset = 7;
    }
    if (offset < bestOffset) bestOffset = offset;
  }
  const nextDay = (todayDow + bestOffset) % 7;
  return `${t(`days.${nextDay}`)} ${schedule.startTime}`;
}
