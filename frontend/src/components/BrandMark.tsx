/** Concentric arcs radiating from a point: a signal going out, things found nearby. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="17" r="2.5" fill="currentColor" stroke="none" />
      <path d="M7.4 12.8a6.4 6.4 0 0 1 9.2 0" />
      <path d="M4 9.2a11.4 11.4 0 0 1 16 0" />
    </svg>
  );
}
