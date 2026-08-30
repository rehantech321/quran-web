import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { loginSchema } from "@halaqat/shared";

import { BrandMark } from "@/components/BrandMark";
import { CornerArabesque, GirihPattern, MihrabArch } from "@/components/ornament";
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
  const reduceMotion = useReducedMotion();

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
    <div className="flex min-h-screen flex-col bg-cream-100 lg:flex-row">
      {/* Hero: this mosque's own students at a memorization achievement ceremony. */}
      <div className="relative flex h-80 shrink-0 items-end overflow-hidden lg:h-auto lg:flex-1 lg:items-center">
        <img
          src="/images/mosque-hero.webp"
          alt=""
          // The Center Director is standing at the right edge of this wide
          // group photo — `object-cover`'s default (center-anchored) crop
          // cut him off on narrower screens. Anchoring right instead keeps
          // him in frame; anchoring top keeps faces in frame over floor/carpet.
          className="absolute inset-0 h-full w-full object-cover object-right-top"
        />
        {/* Flat neutral scrim first (works regardless of how bright/busy the
            photo is), then a stronger directional wash behind the text —
            deliberately black, not the brand green: a dark-green overlay
            under the (also dark green) logo let the logo blend into its own
            background instead of standing out. */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/15 lg:bg-gradient-to-r lg:from-black/15 lg:via-black/60 lg:to-black/90" />
        <GirihPattern color="var(--c-gold-400)" opacity={0.08} tileSize={88} />
        <MihrabArch
          variant="cap"
          className="absolute inset-x-0 -top-1 h-14 w-full text-primary-950/90 lg:hidden"
        />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 flex w-full flex-col items-center gap-3 px-6 pb-8 text-center lg:items-start lg:px-16 lg:pb-0 lg:text-start"
        >
          <div className="relative">
            <div className="absolute inset-0 -m-6 rounded-full bg-cream-50/25 blur-2xl" />
            <BrandMark className="relative h-44 w-60 brightness-125 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] lg:h-72 lg:w-[26rem]" />
          </div>
          <h1 className="font-display text-3xl leading-tight text-cream-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] lg:text-5xl">
            {t("app.title")}
          </h1>
          <p className="hidden max-w-xs font-display text-sm italic text-cream-100/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] lg:block lg:max-w-sm lg:text-lg">
            {t("auth.tagline")}
          </p>
        </motion.div>
      </div>

      {/* Form */}
      <div className="relative flex flex-1 items-start justify-center p-4 pt-8 lg:w-[440px] lg:flex-none lg:items-center lg:p-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <Card className="relative overflow-hidden">
            <CornerArabesque corner="top-start" />
            <CornerArabesque corner="bottom-end" />
            <div className="flex flex-col items-center gap-1 px-6 pt-8">
              <h2 className="font-display text-xl text-primary-900">
                {t("auth.signIn")}
              </h2>
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
        </motion.div>
      </div>
    </div>
  );
}
