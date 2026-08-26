import type { HTMLAttributes, ReactNode } from "react";

import { GirihPattern } from "@/components/ornament/GirihPattern";
import { cn } from "@/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-cream-200 bg-cream-50 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

/** Deep green band with a subtle girih pattern at 6% white and a gold hairline bottom edge (SPEC.md §2.3.5). */
export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-b-2 border-gold-500 bg-primary-900 px-4 py-3",
        className,
      )}
    >
      <GirihPattern color="#ffffff" opacity={0.06} tileSize={40} />
      <div className="relative font-display text-lg text-cream-50">{children}</div>
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
