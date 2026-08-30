import type { SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { AppShell, type NavItem } from "@/layouts/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { useOrganization } from "@/queries/organizations";
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
          // This same node renders in two very different slots: a full-width
          // mobile top bar (plenty of horizontal room) and a fixed ~208px-wide
          // desktop sidebar header (AppShell's `w-60` aside). A single-row
          // layout that looked fine on mobile overlapped illegibly in the
          // sidebar once a real (longer) org name was involved — `md:` here
          // means "in the narrow sidebar slot", so it stacks branding above
          // the language/sign-out buttons only there, and truncates the name
          // instead of letting it wrap mid-word.
          <div className="flex w-full items-center justify-between gap-2 md:flex-col md:items-stretch md:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark className="h-12 w-14 shrink-0" />
              <p className="min-w-0 truncate font-display text-base text-primary-900">
                {org?.name ?? t("app.title")}
              </p>
            </div>
            <div className="flex items-center gap-2 md:flex-wrap">
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
