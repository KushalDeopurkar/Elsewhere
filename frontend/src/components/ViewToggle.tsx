"use client";

import { ViewMode } from "@/lib/filters";

/** Switches between the image-led grid and the dense date-grouped list. */
export default function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Result layout">
      <button
        type="button"
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
        Grid
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        List
      </button>
    </div>
  );
}
