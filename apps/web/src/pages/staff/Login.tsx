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
      {/* Hero: a real halaqa, so the app's own purpose is the first thing seen. */}
      <div className="relative flex h-64 shrink-0 items-end overflow-hidden lg:h-auto lg:flex-1 lg:items-center">
        <img
          src="/images/halaqa-hero.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/95 via-primary-950/55 to-primary-950/10 lg:bg-gradient-to-r lg:from-primary-950/35 lg:via-primary-950/65 lg:to-primary-950/95" />
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
          <BrandMark className="h-24 w-32 brightness-125 lg:h-28 lg:w-40" />
          <div className="flex items-center gap-3 text-gold-400">
            <span className="h-px w-10 bg-gold-400/70" />
            <span className="text-xs uppercase tracking-[0.28em]">Halaqat</span>
            <span className="h-px w-10 bg-gold-400/70" />
          </div>
          <h1 className="font-display text-4xl leading-tight text-cream-50 lg:text-6xl">
            {t("app.title")}
          </h1>
          <p className="max-w-xs font-display text-sm italic text-cream-100/85 lg:max-w-sm lg:text-lg">
            {t("auth.tagline")}
          </p>
        </motion.div>

        <a
          href="https://en.wikipedia.org/wiki/File:Halaq_at_Masjid_al-Haram,_6_April_2015,_Makkah,_Saudi_Arabia.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 end-2 z-10 text-[10px] text-cream-50/60 hover:text-cream-50/90 hover:underline"
        >
          {t("auth.photoCredit")}
        </a>
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
