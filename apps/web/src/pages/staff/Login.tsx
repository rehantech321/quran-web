import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { loginSchema } from "@halaqat/shared";

import { GirihPattern, MihrabArch } from "@/components/ornament";
import { Button, Card, CardBody, Input } from "@/components/ui";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useLogin } from "@/queries/auth";
import { useAuthStore } from "@/store/authStore";

type LoginFormValues = z.infer<typeof loginSchema>;

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  if (accessToken) return <Navigate to="/app/circles" replace />;

  async function onSubmit(values: LoginFormValues) {
    try {
      await login.mutateAsync(values);
      navigate("/app/circles", { replace: true });
    } catch {
      // surfaced below via login.isError
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream-100 p-4">
      <GirihPattern opacity={0.05} />
      <Card className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 px-6 pt-8">
          <MihrabArch variant="cap" className="h-16 w-28 text-primary-900" />
          <h1 className="font-display text-2xl text-primary-900">{t("app.title")}</h1>
        </div>
        <CardBody>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Input
              label={t("auth.identifier")}
              autoComplete="username"
              error={errors.identifier?.message}
              {...register("identifier")}
            />
            <Input
              label={t("auth.password")}
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            {login.isError && (
              <p role="alert" className="text-sm text-danger">
                {getApiErrorMessage(login.error, t("auth.loginError"))}
              </p>
            )}
            <Button type="submit" disabled={login.isPending} className="mt-2">
              {login.isPending ? t("common.loading") : t("auth.signIn")}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
