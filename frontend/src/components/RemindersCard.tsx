"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRinging, BellSimple, DownloadSimple, Export } from "@phosphor-icons/react/ssr";
import { Event } from "@/lib/types";
import { remindersFor } from "@/lib/reminders";
import { promptInstall, pushSupport, Support, turnOff, turnOn, useCanInstall, useReminders } from "@/lib/push";
import { track } from "@/lib/track";

const noop = () => () => {};

/** "Remind me" on the Saved page: a push notification 2 hours before each saved event. */
export default function RemindersCard({ events }: { events: Event[] }) {
  const { on } = useReminders();
  // Browser capabilities: read on the client only, "unsupported" on the server.
  const support = useSyncExternalStore<Support>(noop, pushSupport, () => "unsupported");
  const canInstall = useCanInstall();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coming = remindersFor(events).length;

  if (support === "unsupported" && !canInstall) return null;

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await turnOn(events);
      track("reminders_on", { events: coming });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn reminders on.");
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    await turnOff();
    setBusy(false);
  };

  const live = on && support === "ok";
  return (
    <div className={`remind${live ? " is-on" : ""}`}>
      <span className="remind-icon" aria-hidden="true">
        {live ? <BellRinging size={20} weight="fill" /> : <BellSimple size={20} weight="bold" />}
      </span>
      <div className="remind-text">
        <p className="remind-h">{live ? "Reminders are on" : "Get a reminder"}</p>
        <p className="remind-sub" role="status">
          {error ??
            (support === "install-first"
              ? "On iPhone, add Elsewhere to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and turn reminders on."
              : support === "blocked"
                ? "Notifications are blocked for this site. Allow them in your browser's site settings, then come back."
                : live
                  ? coming
                    ? `A notification 2 hours before each saved event. ${coming} coming up.`
                    : "A notification 2 hours before each saved event. Nothing due right now."
                  : "A notification on this device 2 hours before each saved event.")}
        </p>
      </div>
      <div className="remind-actions">
        {support === "ok" &&
          (live ? (
            <button type="button" className="btn btn-ghost" onClick={disable} disabled={busy}>
              Turn off
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={enable} disabled={busy} aria-busy={busy}>
              <BellSimple size={16} weight="bold" aria-hidden="true" /> {busy ? "Turning on…" : "Remind me"}
            </button>
          ))}
        {support === "install-first" && <Export size={22} weight="bold" className="remind-share" aria-hidden="true" />}
        {canInstall && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              if (await promptInstall()) track("app_installed");
            }}
          >
            <DownloadSimple size={16} weight="bold" aria-hidden="true" /> Install app
          </button>
        )}
      </div>
    </div>
  );
}
