import { useState } from "react";
import { useTranslation } from "react-i18next";

import { getApiErrorMessage } from "@/lib/apiClient";
import { useAddManualPoints } from "@/queries/students";
import { cn } from "@/utils/cn";

import { Modal } from "./Modal";

const PRESETS = [
  { pages: 5, points: 50 },
  { pages: 10, points: 100 },
  { pages: 15, points: 150 },
  { pages: 20, points: 200 },
] as const;

/**
 * "Weekly Memorization Points" — a one-tap shortcut for the single most
 * common manual award (pages memorized this week), instead of typing the
 * amount and a reason by hand every time through the general "Adjust
 * points" form on the student's profile. Still just a specific call into
 * that same `addManualPoints` endpoint — no new points logic, only a faster
 * door into the existing one.
 */
export function WeeklyMemorizationButton({
  studentId,
  fullName,
  className,
}: {
  studentId: string;
  fullName: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const addPoints = useAddManualPoints(studentId);

  async function award(pages: number, points: number) {
    try {
      // The reason is a plain, already-translated sentence (same approach
      // the free-form "Adjust points" reason already uses) — stored and
      // shown verbatim in the student's points history, not an i18n key
      // resolved again later.
      await addPoints.mutateAsync({
        points,
        reason: t("student.weeklyMemorizationReason", { pages }),
      });
      setOpen(false);
    } catch {
      // surfaced below via addPoints.isError — modal stays open on failure
      // so the supervisor can see the message and retry.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t("student.weeklyMemorizationIcon")}
        title={t("student.weeklyMemorizationIcon")}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-900 shadow-sm transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M4 5.5C4 4.67 4.67 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M20 5.5c0-.83-.67-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("student.weeklyMemorizationTitle", { name: fullName })}
      >
        <div className="grid grid-cols-2 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.pages}
              type="button"
              disabled={addPoints.isPending}
              onClick={() => award(p.pages, p.points)}
              className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-cream-200 bg-cream-50 transition-colors hover:bg-cream-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="font-display text-lg text-ink-900">
                {t("student.pagesCount", { count: p.pages })}
              </span>
              <span className="text-xs text-primary-700">
                +{p.points} {t("common.points")}
              </span>
            </button>
          ))}
        </div>
        {addPoints.isError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {getApiErrorMessage(addPoints.error, t("common.error"))}
          </p>
        )}
      </Modal>
    </>
  );
}
