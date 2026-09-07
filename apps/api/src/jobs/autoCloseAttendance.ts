import { logger } from "../config/logger.js";
import { Circle, type CircleFields } from "../models/Circle.js";
import { Organization } from "../models/Organization.js";
import { closeSession } from "../services/attendance.service.js";
import { normalizeSessionDate, resolveTimeOnSessionDate } from "../utils/timezone.js";

/**
 * Auto-closes each circle's attendance session once it's clearly over,
 * marking every still-unscanned active student absent (deducting points)
 * without a supervisor having to remember to tap "Close session" — see
 * DECISIONS.md for why this previously required a manual step.
 */

/**
 * How long after a circle's `lateAfter` cutoff to wait before treating an
 * unscanned student as genuinely absent, rather than "the session is
 * probably still running" or "they're just running late." Generous on
 * purpose — closing too early would wrongly dock a student who was about to
 * scan in.
 */
const AUTO_CLOSE_GRACE_HOURS = 3;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** `date`'s weekday (0=Sunday, matching `Circle.schedule.days`) as observed in `timeZone` — not the server process's own local day. */
function weekdayInTimeZone(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(
    date,
  );
  return WEEKDAY_INDEX[short] ?? date.getDay();
}

/**
 * Pure decision, no database — whether `circle` met today (in `timeZone`)
 * and is now far enough past its `lateAfter` cutoff to auto-close. Exported
 * separately so the boundary logic can be tested without a database.
 */
export function shouldAutoCloseCircle(
  circle: Pick<CircleFields, "schedule">,
  timeZone: string,
  now: Date,
): boolean {
  if (!circle.schedule.days.includes(weekdayInTimeZone(now, timeZone))) return false;

  const sessionDate = normalizeSessionDate(now, timeZone);
  const lateAfterInstant = resolveTimeOnSessionDate(
    sessionDate,
    circle.schedule.lateAfter,
    timeZone,
  );
  const graceDeadline =
    lateAfterInstant.getTime() + AUTO_CLOSE_GRACE_HOURS * 60 * 60 * 1000;
  return now.getTime() > graceDeadline;
}

/**
 * One pass across every active circle in every organization. Safe to call
 * as often as we like — `closeSession` only ever touches students with no
 * attendance record yet for the day, so a circle that's already closed (or
 * has nothing due) is simply a no-op, not a double-charge.
 */
export async function runAutoCloseSweep(now: Date = new Date()): Promise<void> {
  const circles = await Circle.find({ isActive: true, deletedAt: null }).lean();
  const timezoneByOrgId = new Map<string, string | null>();

  for (const circle of circles) {
    const orgId = circle.organizationId.toString();
    if (!timezoneByOrgId.has(orgId)) {
      const org = await Organization.findById(circle.organizationId).lean();
      timezoneByOrgId.set(orgId, org?.timezone ?? null);
    }
    const timezone = timezoneByOrgId.get(orgId);
    if (!timezone) continue;

    if (!shouldAutoCloseCircle(circle, timezone, now)) continue;

    try {
      const result = await closeSession({
        organizationId: circle.organizationId,
        circleId: circle._id,
        sessionDate: now,
        recordedBy: circle.supervisorId,
      });
      if (result.markedAbsent > 0) {
        logger.info(
          { circleId: circle._id, markedAbsent: result.markedAbsent },
          "Auto-closed an attendance session",
        );
      }
    } catch (err) {
      logger.error({ err, circleId: circle._id }, "Auto-close sweep failed for a circle");
    }
  }
}

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Starts the recurring sweep. Call once, from the real server process only
 * (`index.ts`) — never from `createApp()`, so the test suite (which builds
 * many `createApp()` instances) never spins up a background timer per test.
 */
export function startAutoCloseScheduler(): void {
  const sweep = () => {
    runAutoCloseSweep().catch((err) => {
      logger.error({ err }, "Auto-close sweep crashed");
    });
  };
  sweep(); // catch up immediately on startup rather than waiting a full interval
  setInterval(sweep, SWEEP_INTERVAL_MS);
}
