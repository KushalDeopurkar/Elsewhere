"use client";

import { ArrowSquareOut, CheckCircle, ShareNetwork } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { openSignIn, socialConfigured, useAuth } from "@/lib/auth";
import { isRealEvent } from "@/lib/supabase";
import { useMyStatus } from "@/lib/going";
import { recordSignal } from "@/lib/taste";
import SaveButton from "./SaveButton";
import RemindButton from "./RemindButton";

/**
 * Phones: the event's main actions pinned above the tab bar from the first
 * paint, so getting a ticket is never a scroll away. Hidden on wide screens,
 * where the booking panel sits beside the content.
 */
export default function EventActionBar({ event, ctaLabel, price }: { event: Event; ctaLabel: string; price: string }) {
  const { session } = useAuth();
  const social = socialConfigured && isRealEvent(event);
  const [{ status }, set] = useMyStatus(event.id, social);
  const going = status === "going";

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="actionbar" role="region" aria-label="Event actions">
      <span className="actionbar-price">{price}</span>
      {social ? (
        <button
          type="button"
          className={`actionbar-going${going ? " is-on" : ""}`}
          aria-pressed={going}
          onClick={async () => {
            if (!session) return openSignIn("to say you're going");
            await set(going ? null : "going").catch(() => undefined);
            if (!going) recordSignal(event, "save");
          }}
        >
          <CheckCircle size={18} weight={going ? "fill" : "bold"} aria-hidden="true" /> {going ? "Going" : "I'm going"}
        </button>
      ) : (
        <SaveButton event={event} variant="icon" />
      )}
      <RemindButton event={event} variant="icon" />
      <button type="button" className="icon-btn actionbar-share" aria-label="Share this event" onClick={share}>
        <ShareNetwork size={18} weight="bold" />
      </button>
      {event.url && (
        <a className="btn btn-primary actionbar-cta" href={event.url} target="_blank" rel="noopener noreferrer">
          {ctaLabel} <ArrowSquareOut size={15} weight="bold" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
