import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary-900 text-cream-50 hover:bg-primary-800 active:bg-primary-950",
  secondary: "bg-cream-50 text-ink-900 border border-cream-200 hover:bg-cream-100",
  ghost: "bg-transparent text-primary-900 hover:bg-primary-900/5",
  danger: "bg-danger text-cream-50 hover:opacity-90",
};

// min-height 44px on the default size satisfies the ≥44px tap-target rule
// (SPEC.md §2.5) — supervisors use this one-handed, standing, mid-session.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
});
