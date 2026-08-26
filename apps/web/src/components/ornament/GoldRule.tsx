export interface GoldRuleProps {
  className?: string;
  color?: string;
}

/** A 1px gold hairline with a centered diamond motif — used as a section divider instead of `<hr>`. */
export function GoldRule({ className = "", color = "var(--c-gold-500)" }: GoldRuleProps) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      role="separator"
      aria-hidden="true"
    >
      <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.5 }} />
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
        <rect
          x="1.5"
          y="1.5"
          width="7"
          height="7"
          transform="rotate(45 5 5)"
          fill="none"
          stroke={color}
          strokeWidth={1}
        />
      </svg>
      <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.5 }} />
    </div>
  );
}
