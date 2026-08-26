import type { SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { AppShell, type NavItem } from "@/layouts/AppShell";
import { useOrganization } from "@/queries/organizations";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/queries/auth";

function CirclesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth={1.75} />
      <circle cx="15" cy="15" r="5" stroke="currentColor" strokeWidth={1.75} />
    </svg>
  );
}

function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M4 12h16"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M5 19V9M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth={1.75} />
      <path
        d="M4.5 20c1.5-4 5-5.5 7.5-5.5S18 16 19.5 20"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StaffLayout() {
  const { t, i18n } = useTranslation();
  const { data: org } = useOrganization();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const navItems: NavItem[] = [
    { to: "/app/circles", label: t("nav.circles"), icon: <CirclesIcon /> },
    { to: "/app/scan", label: t("nav.scan"), icon: <ScanIcon /> },
    { to: "/app/reports", label: t("nav.reports"), icon: <ReportsIcon /> },
    { to: "/app/settings", label: t("nav.profile"), icon: <ProfileIcon /> },
  ];

  return (
    <ThemeProvider theme={org?.theme}>
      <AppShell
        navItems={navItems}
        header={
          <div className="flex w-full items-center justify-between gap-2">
            <div>
              <p className="font-display text-base text-primary-900">
                {org?.name ?? t("app.title")}
              </p>
              {user && <p className="text-xs text-ink-600">{user.fullName}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-ink-600 hover:bg-cream-200"
                onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
              >
                {t("common.language")}
              </button>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-ink-600 hover:bg-cream-200"
                onClick={() => logout.mutate()}
              >
                {t("auth.logout")}
              </button>
            </div>
          </div>
        }
      >
        <Outlet />
      </AppShell>
    </ThemeProvider>
  );
}
