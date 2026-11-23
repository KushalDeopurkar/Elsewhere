"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRinging, BellSimple } from "@phosphor-icons/react/ssr";
import type { Event } from "@/lib/types";
import { reminderFor } from "@/lib/reminders";
import { pushSupport, type Support, turnOn, useReminders } from "@/lib/push";
import { ensureSaved, isSaved, readSaved, removeSaved, useSaved } from "@/lib/saved";
import { isRealEvent } from "@/lib/supabase";
import { track } from "@/lib/track";

const noop = () => () => {};

/**
 * "Remind me" on an event page: a push notification 2 hours before it
 * starts. Reminders follow the Saved list, so this saves the event and, the
 * first time, asks for notification permission. Pressed again, it takes the
 * event back out of Saved, which drops its reminder.
 */
export default function RemindButton({ event, variant = "button" }: { event: Event; variant?: "button" | "icon" }) {
  const { on } = useReminders();
  const saved = isSaved(useSaved(), event.id);
  const support = useSyncExternalStore<Support>(noop, pushSupport, () => "unsupported");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Nothing to remind about (already started, or months away), or a browser
  // with no way to get notifications.
  if (!isRealEvent(event) || !reminderFor(event) || support === "unsupported") return null;

  const set = saved && on && support === "ok";
  const tell = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((s) => (s === msg ? "" : s)), 6000);
  };

  const press = async () => {
    if (support === "install-first") {
      return tell("On iPhone, reminders need the app: tap Share, then Add to Home Screen, and open Elsewhere from there.");
    }
    if (support === "blocked") {
      return tell("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
    }
    if (set) {
      removeSaved(event.id);
      return tell("Reminder off, and removed from Saved.");
    }
    setBusy(true);
    ensureSaved(event);
    try {
      // Already on: the Saved list re-syncs by itself (AppRoot).
      if (!on) await turnOn(readSaved().map((s) => s.event).filter(isRealEvent));
      track("reminders_on", { source: "event" });
      tell("You'll get a notification 2 hours before it starts. Saved, too.");
    } catch (e) {
      tell(e instanceof Error ? e.message : "Couldn't turn the reminder on.");
    } finally {
      setBusy(false);
    }
  };

  const Icon = set ? BellRinging : BellSimple;
  const label = set ? "Reminder set" : "Remind me";
  return (
    <>
      <button
        type="button"
        className={variant === "icon" ? `icon-btn remind-icon-btn${set ? " is-on" : ""}` : `btn btn-ghost remind-btn${set ? " is-on" : ""}`}
        aria-pressed={set}
        aria-label={variant === "icon" ? label : undefined}
        title={set ? "Reminder set: press to turn it off" : "Get a notification 2 hours before"}
        onClick={press}
        disabled={busy}
        aria-busy={busy}
      >
        <Icon size={variant === "icon" ? 18 : 17} weight={set ? "fill" : "bold"} aria-hidden="true" />
        {variant === "button" && (busy ? "Turning on…" : label)}
      </button>
      <p className="remind-toast" role="status" aria-live="polite" hidden={!note}>
        {note}
      </p>
    </>
  );
}
