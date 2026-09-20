import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { isLikelyValidWhatsAppPhone, openWhatsAppChat } from "@/lib/whatsapp";
import { cn } from "@/utils/cn";

/**
 * A permanent, one-tap "message the parent" button — for lists where a
 * supervisor needs to reach a parent immediately (e.g. right after seeing a
 * student marked absent) without first navigating into that student's full
 * profile. Opens WhatsApp with an empty compose box; the supervisor still
 * types and sends themselves, same as every other WhatsApp integration in
 * this app.
 *
 * Always rendered, for every student. If the parent's number is missing or
 * too short to be a real WhatsApp number, the button turns grey instead of
 * disappearing — hiding it made those students look like they'd simply been
 * skipped, when the actual problem is a bad number the supervisor needs to
 * know about. Tapping the grey button takes them to that student's profile
 * to fix it (pass `studentId` for that).
 */
export function WhatsAppButton({
  phone,
  studentId,
  className,
}: {
  phone: string | undefined;
  studentId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isUsable = Boolean(phone) && isLikelyValidWhatsAppPhone(phone!);
  const label = isUsable ? t("whatsapp.sendMessage") : t("whatsapp.missingPhone");

  return (
    <button
      type="button"
      onClick={(e) => {
        // Most call sites nest this inside a card-level <Link> to the
        // student's profile — stop that link from also firing, and do
        // exactly one thing ourselves.
        e.preventDefault();
        e.stopPropagation();
        if (isUsable) {
          openWhatsAppChat(phone!, "");
        } else if (studentId) {
          navigate(`/app/students/${studentId}`);
        }
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
        isUsable ? "bg-[#25D366] text-white" : "bg-cream-200 text-ink-400",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.83 14.11c-.25.7-1.24 1.29-1.93 1.44-.51.11-1.18.2-3.42-.73-2.87-1.19-4.72-4.1-4.86-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09 1-2.38.25-.27.55-.34.74-.34h.53c.17 0 .4-.06.62.48.25.6.85 2.08.92 2.23.07.15.12.33.02.53-.09.2-.14.32-.28.49-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.17-.2.71-.83.9-1.11.19-.28.38-.23.63-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.18 1.38z" />
      </svg>
    </button>
  );
}
