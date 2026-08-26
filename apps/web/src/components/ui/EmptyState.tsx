import type { ReactNode } from "react";

import { GirihPattern } from "@/components/ornament";
import { cn } from "@/utils/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** A tasteful empty state — girih pattern behind clear Arabic copy, never a bare "no data" (SPEC.md §7 screen 19). */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-cream-200 bg-cream-50 p-8 text-center",
        className,
      )}
    >
      <GirihPattern opacity={0.04} />
      <div className="relative flex flex-col items-center gap-2">
        <p className="font-display text-lg text-primary-900">{title}</p>
        {description && <p className="text-sm text-ink-600">{description}</p>}
        {action}
      </div>
    </div>
  );
}
