export interface MihrabArchProps {
  className?: string;
  color?: string;
  /**
   * "cap" — a filled decorative topper shape, meant to sit as the top edge of a
   * hero card (SPEC.md §7 screen 13: the student dashboard hero).
   * "frame" — an open arch outline, meant to frame the QR scanner viewport
   * (SPEC.md §7 screen 4).
   */
  variant?: "cap" | "frame";
}

/** The pointed-arch silhouette from the mosque logo. Decorative — `aria-hidden`. */
export function MihrabArch({
  className,
  color = "var(--c-primary-900)",
  variant = "cap",
}: MihrabArchProps) {
  if (variant === "frame") {
    return (
      <svg viewBox="0 0 240 300" className={className} aria-hidden="true" fill="none">
        <path
          d="M 20 300
             L 20 140
             C 20 70 60 20 120 20
             C 180 20 220 70 220 140
             L 220 300"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 400 160"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M 0 160
           L 0 90
           C 0 40 70 0 200 0
           C 330 0 400 40 400 90
           L 400 160
           Z"
        fill={color}
      />
    </svg>
  );
}
