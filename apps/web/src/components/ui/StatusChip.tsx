import type { SVGProps } from "react";

import { cn } from "@/utils/cn";

export type ChipTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<ChipTone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  neutral: "bg-ink-400/10 text-ink-600",
};

function CheckGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M8 4.5V8l2.5 1.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function DashGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M4 8h8" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

function InfoGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M8 7.5v3.5M8 5.5v.01"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

const TONE_GLYPHS: Record<ChipTone, (props: SVGProps<SVGSVGElement>) => JSX.Element> = {
  success: CheckGlyph,
  danger: CrossGlyph,
  warning: ClockGlyph,
  info: InfoGlyph,
  neutral: DashGlyph,
};

export interface StatusChipProps {
  tone: ChipTone;
  label: string;
  className?: string;
}

/** Pairs color with an icon and a label — color is never the sole carrier of meaning (SPEC.md §8). */
export function StatusChip({ tone, label, className }: StatusChipProps) {
  const Glyph = TONE_GLYPHS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Glyph className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
