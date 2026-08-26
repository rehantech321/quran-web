import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/utils/cn";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export interface AppShellProps {
  navItems: NavItem[];
  children: ReactNode;
  header?: ReactNode;
}

/**
 * Desktop gets a persistent sidebar; mobile gets a bottom tab bar (SPEC.md
 * §2.5). Uses logical properties throughout (`border-e`, `start-`/`end-`
 * implicitly via flex direction following `dir`) so it mirrors correctly
 * under both `dir="rtl"` and `dir="ltr"` without any left/right classes.
 */
export function AppShell({ navItems, children, header }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-100 md:flex-row">
      <aside className="hidden w-60 shrink-0 border-e border-cream-200 bg-cream-50 md:flex md:flex-col">
        {header && <div className="border-b border-cream-200 p-4">{header}</div>}
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
          {navItems.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
      </aside>

      {header && (
        <header className="flex items-center justify-between border-b border-cream-200 bg-cream-50 px-4 py-3 md:hidden">
          {header}
        </header>
      )}

      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-cream-200 bg-cream-50 md:hidden"
        aria-label="Main"
      >
        {navItems.map((item) => (
          <BottomTabLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}

function SidebarLink({ to, label, icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
          isActive
            ? "bg-primary-900 text-cream-50"
            : "text-ink-600 hover:bg-cream-200 hover:text-ink-900",
        )
      }
    >
      <span className="h-5 w-5 shrink-0">{icon}</span>
      {label}
    </NavLink>
  );
}

function BottomTabLink({ to, label, icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500",
          isActive ? "text-primary-900" : "text-ink-400",
        )
      }
    >
      <span className="h-5 w-5">{icon}</span>
      {label}
    </NavLink>
  );
}
