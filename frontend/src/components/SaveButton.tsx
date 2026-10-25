"use client";

import { useSavedEvents } from "@/lib/savedEvents";
import { BookmarkIcon } from "./icons";

/**
 * Save toggle.
 *
 * Renders as unsaved until the stored list has loaded, so the server HTML and
 * the first client render agree. The label says "on this device" because that
 * is literally where the list lives — there is no account behind it.
 */
export default function SaveButton({
  eventId,
  title,
  size = 16,
}: {
  eventId: string;
  title: string;
  size?: number;
}) {
  const { isSaved, toggle, ready } = useSavedEvents();
  const saved = ready && isSaved(eventId);

  return (
    <button
      type="button"
      className="save-button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title} on this device`}
      title={saved ? "Saved on this device" : "Save on this device"}
      onClick={(e) => {
        // The card is a stretched link; don't navigate when saving.
        e.preventDefault();
        e.stopPropagation();
        toggle(eventId);
      }}
    >
      <BookmarkIcon size={size} />
    </button>
  );
}
