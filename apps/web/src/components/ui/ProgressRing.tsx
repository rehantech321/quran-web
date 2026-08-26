export interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  label?: string;
}

/** A small circular progress indicator — e.g. today's attendance-recording progress on a circle card. */
export function ProgressRing({ value, max, size = 44, label }: ProgressRingProps) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--c-cream-200)"
          strokeWidth={5}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--c-gold-500)"
          strokeWidth={5}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-medium text-ink-900">
        {label ?? `${value}/${max}`}
      </span>
    </div>
  );
}
