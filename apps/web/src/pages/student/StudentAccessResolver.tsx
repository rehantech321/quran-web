import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { GirihPattern, MihrabArch } from "@/components/ornament";
import { Button, Input } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useResolveStudentAccess, useVerifyStudentPin } from "@/queries/studentAccess";
import { useStudentAuthStore } from "@/store/studentAuthStore";

/** GET /student/:slug — mints a session (or asks for a PIN first), then hands off to the dashboard. */
export function StudentAccessResolver() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useResolveStudentAccess(slug);
  const setStudentAuth = useStudentAuthStore((s) => s.setStudentAuth);
  const verifyPin = useVerifyStudentPin(slug ?? "");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (data && !data.pinRequired) {
      setStudentAuth(data.token, data.student);
    }
  }, [data, setStudentAuth]);

  if (data && !data.pinRequired) {
    return <Navigate to="/student" replace />;
  }

  async function onSubmitPin(e: React.FormEvent) {
    e.preventDefault();
    await verifyPin.mutateAsync(pin);
    navigate("/student", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream-100 p-6">
      <GirihPattern opacity={0.05} />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <MihrabArch variant="cap" className="h-16 w-28 text-primary-900" />

        {isLoading && <p className="text-ink-600">{t("common.loading")}</p>}

        {isError && (
          <div className="rounded-xl border border-danger/30 bg-cream-50 p-4 text-sm text-danger">
            {t("studentAuth.invalidLink")}
          </div>
        )}

        {data?.pinRequired && (
          <form onSubmit={onSubmitPin} className="flex w-full flex-col gap-3">
            <p className="text-sm text-ink-600">{t("studentAuth.enterPin")}</p>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
            {verifyPin.isError && (
              <p role="alert" className="text-sm text-danger">
                {getApiErrorMessage(verifyPin.error, t("studentAuth.wrongPin"))}
              </p>
            )}
            <Button type="submit" disabled={pin.length !== 4 || verifyPin.isPending}>
              {t("common.confirm")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
