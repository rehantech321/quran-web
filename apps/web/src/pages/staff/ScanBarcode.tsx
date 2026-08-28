import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { MihrabArch } from "@/components/ornament";
import { BrandMark } from "@/components/BrandMark";
import { Button, Input, StatusChip } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useScanAttendance } from "@/queries/attendance";
import type { AttendanceStatus, Student } from "@/types/api";

const SCANNER_ELEMENT_ID = "qr-scanner-viewport";
const RESULT_DISPLAY_MS = 1500;

const STATUS_TONE: Record<
  AttendanceStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "neutral",
};

interface ScanResultView {
  student: Student;
  status: AttendanceStatus;
  pointsAwarded?: number;
  alreadyRecorded: boolean;
}

export function ScanBarcode() {
  const { t } = useTranslation();
  const { circleId } = useParams<{ circleId: string }>();
  const scan = useScanAttendance(circleId!);
  const reduceMotion = useReducedMotion();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResultView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<ScanResultView[]>([]);
  const [manualValue, setManualValue] = useState("");

  const handleDecoded = useCallback(
    async (barcodeValue: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      // `pause()`/`resume()` throw synchronously if the scanner isn't in the
      // matching state — same html5-qrcode gotcha as `stop()` on unmount
      // (see the cleanup effect below). This function is also called from
      // manual entry, where the camera may never have started at all (no
      // camera device, denied permission — exactly when manual entry is
      // needed), so an unguarded `.pause()` here threw synchronously and,
      // since it's ahead of the try/catch, silently dropped the whole submit:
      // the attendance API call below was never even reached.
      try {
        if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.pause(true);
        }
      } catch {
        // not in a pausable state — nothing to pause
      }
      setErrorMessage(null);

      try {
        const data = await scan.mutateAsync(barcodeValue);
        const view: ScanResultView = {
          student: data.student,
          status: data.record.status,
          pointsAwarded: data.record.pointsAwarded,
          alreadyRecorded: data.alreadyRecorded,
        };
        setResult(view);
        setRecent((prev) => [view, ...prev].slice(0, 5));
      } catch (err) {
        setErrorMessage(getApiErrorMessage(err, t("attendance.unknownBarcode")));
      } finally {
        setTimeout(() => {
          setResult(null);
          setErrorMessage(null);
          processingRef.current = false;
          try {
            if (scannerRef.current?.getState() === Html5QrcodeScannerState.PAUSED) {
              scannerRef.current.resume();
            }
          } catch {
            // not in a resumable state — nothing to resume
          }
        }, RESULT_DISPLAY_MS);
      }
    },
    [scan, t],
  );

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cancelled) return;
        if (cameras.length === 0) {
          setCameraError("no-camera");
          return;
        }
        return scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => void handleDecoded(decodedText),
          undefined,
        );
      })
      .catch((err) => !cancelled && setCameraError(String(err)));

    return () => {
      cancelled = true;
      // `stop()` throws synchronously (not a rejected promise) if the scanner
      // never successfully started — e.g. no camera device, or the user denied
      // permission. Check its state first so an unmount in that case doesn't
      // crash the whole route.
      try {
        const state = scanner.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          scanner
            .stop()
            .catch(() => undefined)
            .then(() => scanner.clear())
            .catch(() => undefined);
        }
      } catch {
        // scanner was never initialized far enough to have a queryable state
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner lifecycle is set up once
  }, []);

  async function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualValue.trim()) return;
    await handleDecoded(manualValue.trim());
    setManualValue("");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-primary-950">
      <div className="flex items-center justify-between p-4">
        <BrandMark className="h-12 w-16 brightness-125" />
        <Link to={`/app/circles/${circleId}`} className="text-sm text-cream-100">
          &rarr; {t("common.back")}
        </Link>
      </div>

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl">
          <div
            id={SCANNER_ELEMENT_ID}
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          <MihrabArch
            variant="frame"
            className="pointer-events-none absolute inset-0 h-full w-full text-gold-400"
            aria-hidden="true"
          />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-950/90 p-4 text-center text-sm text-cream-100">
              {t("attendance.manualEntry")}
            </div>
          )}
        </div>

        {!cameraError && (
          <p className="mt-4 text-sm text-cream-100">{t("attendance.scanPrompt")}</p>
        )}

        <div aria-live="assertive" className="mt-4 min-h-24 w-full">
          <AnimatePresence>
            {result && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 12 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  boxShadow: reduceMotion
                    ? undefined
                    : [
                        "0 0 0 0 rgba(200,162,74,0)",
                        "0 0 24px 4px rgba(200,162,74,0.55)",
                        "0 0 0 0 rgba(200,162,74,0)",
                      ],
                }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center gap-2 rounded-xl border border-gold-500/40 bg-cream-50 p-4 shadow-lg"
              >
                {result.student.photoUrl ? (
                  <img
                    src={result.student.photoUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-cream-200" />
                )}
                <p className="font-display text-lg text-primary-900">
                  {result.student.fullName}
                </p>
                <StatusChip
                  tone={STATUS_TONE[result.status]}
                  label={`${t(`attendance.${result.status}`)} ${
                    result.pointsAwarded !== undefined
                      ? (result.pointsAwarded >= 0 ? "+" : "") + result.pointsAwarded
                      : ""
                  }`}
                />
                {result.alreadyRecorded && (
                  <p className="text-xs text-ink-600">{t("attendance.alreadyScanned")}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {errorMessage && (
            <div className="rounded-xl border border-danger/40 bg-cream-50 p-3 text-center text-sm text-danger">
              {errorMessage}
            </div>
          )}
        </div>

        <form onSubmit={onManualSubmit} className="mt-4 flex w-full gap-2">
          <Input
            className="flex-1 bg-cream-50"
            placeholder={t("attendance.manualEntry")}
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
          />
          <Button type="submit">{t("common.confirm")}</Button>
        </form>
      </div>

      {recent.length > 0 && (
        <div className="border-t border-cream-50/10 p-4">
          <p className="mb-2 text-xs text-cream-100/70">
            {t("attendance.recentlyScanned")}
          </p>
          <div className="flex gap-2 overflow-x-auto">
            {recent.map((r, i) => (
              <div
                key={i}
                className="flex shrink-0 items-center gap-2 rounded-full bg-cream-50/10 px-3 py-1.5 text-xs text-cream-50"
              >
                {r.student.fullName}
                <StatusChip
                  tone={STATUS_TONE[r.status]}
                  label={t(`attendance.${r.status}`)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
