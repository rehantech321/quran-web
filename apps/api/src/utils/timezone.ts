import { fromZonedTime } from "date-fns-tz";

/**
 * Extracts the wall-clock calendar date for `date` in `timeZone` using Intl,
 * which resolves the correct UTC offset for that zone/instant regardless of
 * the server process's own TZ setting. We deliberately avoid date-fns-tz's
 * `toZonedTime` + plain date-fns functions (e.g. startOfDay) here — that combo
 * only produces correct results if the Node process itself runs with
 * `TZ=UTC`, because plain date-fns reads local Date getters. `fromZonedTime`
 * has no such requirement, so all conversions below go through it.
 */
function wallClockDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The UTC instant representing 00:00 local time, in `timeZone`, on the
 * calendar day that `date` falls on in that zone. Used to normalize
 * `sessionDate` per SPEC.md §4 ("normalized to 00:00 in org timezone").
 */
export function normalizeSessionDate(date: Date, timeZone: string): Date {
  const { year, month, day } = wallClockDateParts(date, timeZone);
  return fromZonedTime(`${year}-${month}-${day}T00:00:00`, timeZone);
}

/**
 * The UTC instant for `timeOfDay` ("HH:MM") local time, in `timeZone`, on the
 * same calendar day as `sessionDate` (which must already be normalized via
 * `normalizeSessionDate`).
 */
export function resolveTimeOnSessionDate(
  sessionDate: Date,
  timeOfDay: string,
  timeZone: string,
): Date {
  const { year, month, day } = wallClockDateParts(sessionDate, timeZone);
  return fromZonedTime(`${year}-${month}-${day}T${timeOfDay}:00`, timeZone);
}

/** Whether `instant` falls after `timeOfDay` local time on `sessionDate`'s calendar day. */
export function isAfterTimeOnSessionDate(
  instant: Date,
  sessionDate: Date,
  timeOfDay: string,
  timeZone: string,
): boolean {
  return (
    instant.getTime() >
    resolveTimeOnSessionDate(sessionDate, timeOfDay, timeZone).getTime()
  );
}
