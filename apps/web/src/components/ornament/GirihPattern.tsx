import { useId } from "react";

export interface GirihPatternProps {
  /** Opacity of the pattern — SPEC.md §2.3 caps this at 3–5% so it never competes with content. */
  opacity?: number;
  color?: string;
  className?: string;
  /** Size of one repeating tile, in px. */
  tileSize?: number;
}

/**
 * An 8-point star (khatim) tessellation rendered as a tileable SVG `<pattern>`,
 * absolutely positioned to fill its nearest `position: relative` ancestor.
 * Decorative only — `aria-hidden` — used behind content on the login page,
 * dashboard header bands, and empty states (SPEC.md §2.3).
 */
export function GirihPattern({
  opacity = 0.04,
  color = "var(--c-primary-900)",
  className,
  tileSize = 64,
}: GirihPatternProps) {
  const patternId = `girih-${useId().replace(/:/g, "")}`;
  const half = tileSize / 2;
  const cx = half;
  const cy = half;
  const outerR = tileSize * 0.46;
  const innerR = tileSize * 0.19;

  const starPoints = Array.from({ length: 16 }, (_, i) => {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width={tileSize}
          height={tileSize}
          patternUnits="userSpaceOnUse"
        >
          <polygon points={starPoints} fill={color} opacity={opacity} />
          <rect
            x={0}
            y={0}
            width={tileSize}
            height={tileSize}
            fill="none"
            stroke={color}
            strokeOpacity={opacity * 0.6}
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
