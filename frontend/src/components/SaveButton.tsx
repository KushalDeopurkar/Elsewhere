"use client";

import { BookmarkSimple } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { isSaved, toggleSaved, useSaved } from "@/lib/saved";

/** Bookmark toggle. Sits above a card's full-card link, so it stops the click. */
export default function SaveButton({
  event,
  variant = "icon",
}: {
  event: Event;
  variant?: "icon" | "button";
}) {
  const saved = isSaved(useSaved(), event.id);
  const label = saved ? "Remove from saved" : "Save event";

  return (
    <button
      type="button"
      className={variant === "icon" ? `save-icon${saved ? " is-saved" : ""}` : `btn btn-ghost save-btn${saved ? " is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={variant === "icon" ? label : undefined}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(event);
      }}
    >
      <BookmarkSimple size={variant === "icon" ? 18 : 17} weight={saved ? "fill" : "bold"} />
      {variant === "button" && (saved ? "Saved" : "Save")}
    </button>
  );
}
