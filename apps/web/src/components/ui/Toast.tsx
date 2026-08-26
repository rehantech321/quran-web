import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ToastTone = "success" | "danger" | "warning" | "info";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-success/40 text-success",
  danger: "border-danger/40 text-danger",
  warning: "border-warning/40 text-warning",
  info: "border-info/40 text-info",
};

const TOAST_DURATION_MS = 4000;
let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reduceMotion = useReducedMotion();

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = String(toastIdCounter++);
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        // bottom-center on mobile, top-end on desktop (SPEC.md §8) — `sm:end-4`
        // flips sides automatically under dir="rtl", no LTR-only left/right used.
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:top-4 sm:end-4 sm:items-end"
        >
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                role="status"
                className={`pointer-events-auto w-full max-w-sm rounded-lg border bg-cream-50 px-4 py-3 text-sm shadow-lg sm:w-auto ${TONE_CLASSES[toast.tone]}`}
              >
                {toast.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
