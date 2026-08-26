export interface CornerArabesqueProps {
  /** Logical corner — SPEC.md §2.3: top-start and bottom-end of "achievement" cards. */
  corner: "top-start" | "bottom-end";
  className?: string;
  color?: string;
  size?: number;
}

const CORNER_POSITION_CLASSES: Record<CornerArabesqueProps["corner"], string> = {
  "top-start": "top-0 start-0",
  "bottom-end": "bottom-0 end-0 rotate-180",
};

/** A small gold corner flourish for achievement cards (points total, approved task, correct answer). Decorative — `aria-hidden`. */
export function CornerArabesque({
  corner,
  className = "",
  color = "var(--c-gold-500)",
  size = 36,
}: CornerArabesqueProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={`pointer-events-none absolute ${CORNER_POSITION_CLASSES[corner]} ${className}`}
    >
      <path
        d="M3 3 C3 16 3 20 16 20 C7 20 3 24 3 33"
        stroke={color}
        strokeWidth={1.25}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
      <path
        d="M8 3 C8 11 8 13 16 13"
        stroke={color}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
      <circle cx="3" cy="3" r="2" fill={color} />
      <rect
        x="14.5"
        y="17.5"
        width="5"
        height="5"
        transform="rotate(45 17 20)"
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.8}
      />
    </svg>
  );
}
