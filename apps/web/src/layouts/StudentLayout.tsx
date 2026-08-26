import type { SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";

import { AppShell, type NavItem } from "@/layouts/AppShell";

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TasksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect
        x="5"
        y="4"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path
        d="M8.5 10.5 10.5 12.5 15.5 8"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuestionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.75} />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .7-1 1.5v.2"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
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

export function StudentLayout() {
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { to: "/student", label: t("nav.home"), icon: <HomeIcon />, end: true },
    { to: "/student/tasks", label: t("nav.tasks"), icon: <TasksIcon /> },
    { to: "/student/question", label: t("nav.questions"), icon: <QuestionIcon /> },
    { to: "/student/profile", label: t("nav.profile"), icon: <ProfileIcon /> },
  ];

  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  );
}
