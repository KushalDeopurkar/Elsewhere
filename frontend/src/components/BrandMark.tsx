import type React from "react";

/**
 * The Elsewhere mark: a letter E on a split-flap departures tile, split at
 * the hinge, its top corner peeling up as the next destination flips in.
 * Frame and letter take the text colour; the peeled corner takes the
 * signal accent (--brand-accent, set in core.css).
 */
export default function BrandMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M43 4.5H12.5a8 8 0 0 0-8 8v39a8 8 0 0 0 8 8h39a8 8 0 0 0 8-8V21.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <path
        d="M45.4 1.8h6.1a10.7 10.7 0 0 1 10.7 10.7v6.1l-5.4-5.4v-.7a5.3 5.3 0 0 0-5.3-5.3h-.7z"
        fill="var(--brand-accent, #fcd726)"
      />
      <g fill="currentColor">
        <rect x="6.2" y="27" width="3.6" height="8" rx="1.6" />
        <rect x="54.2" y="27" width="3.6" height="8" rx="1.6" />
        <rect x="8" y="30.2" width="48" height="1.6" />
        <path d="M17 14h27v6.5H24.5V25H41v4.4H17z" />
        <path d="M17 32.6h24v1.8H24.5v8.1h20v7H17z" />
      </g>
    </svg>
  );
}
