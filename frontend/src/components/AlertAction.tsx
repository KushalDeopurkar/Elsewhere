"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRinging, BellSlash, Check, WarningCircle } from "@phosphor-icons/react/ssr";
import EventCard from "./EventCard";
import type { Event } from "@/lib/types";

/**
 * Confirm or turn off an email alert. The emailed link opens this page and
 * nothing happens until the person presses the button, so automated link
 * scanners in mail systems cannot change anything.
 */
export default function AlertAction({ action, token }: { action: "confirm" | "unsubscribe"; token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ query: string; city?: string | null; events?: Event[]; alreadyOn?: boolean } | null>(null);

  const go = async () => {
    setState("busy");
    setError(null);
    try {
      const res =
        action === "confirm"
          ? await fetch("/api/alerts/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            })
          : await fetch(`/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setResult(json.data);
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };

  if (!token) {
    return (
      <div className="alert-panel">
        <h1>That link is incomplete</h1>
        <p className="lede">Open the link from your email again, or create a new alert from any search.</p>
        <Link className="btn btn-ghost" href="/">Back to events</Link>
      </div>
    );
  }

  if (state === "done" && result) {
    if (action === "unsubscribe") {
      return (
        <div className="alert-panel">
          <h1><BellSlash size={28} weight="duotone" /> Alert turned off</h1>
          <p className="lede">You won&apos;t get more emails for “{result.query}”.</p>
          <Link className="btn btn-ghost" href="/">Back to events</Link>
        </div>
      );
    }
    const events = result.events ?? [];
    return (
      <div className="alert-panel">
        <h1><Check size={28} weight="bold" /> {result.alreadyOn ? "Your alert is already on" : "Alert on"}</h1>
        <p className="lede">
          You&apos;ll get an email when new events like “{result.query}”{result.city ? ` in ${result.city}` : ""} are
          listed. We check after every update, every 6 hours.
        </p>
        {events.length > 0 && (
          <>
            <h2 className="alert-sub">Already listed</h2>
            <div className="grid-results">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </>
        )}
        <Link className="btn btn-ghost" href="/" style={{ marginTop: "1.5rem" }}>Back to events</Link>
      </div>
    );
  }

  const confirm = action === "confirm";
  return (
    <div className="alert-panel">
      <h1>
        {confirm ? <BellRinging size={28} weight="duotone" /> : <BellSlash size={28} weight="duotone" />}{" "}
        {confirm ? "Turn on this alert?" : "Turn off this alert?"}
      </h1>
      <p className="lede">
        {confirm
          ? "You'll get an email when new matching events are listed. Every email has a link to turn it off."
          : "You'll stop getting emails for this alert."}
      </p>
      <button type="button" className="btn btn-primary" onClick={go} disabled={state === "busy"}>
        {state === "busy" ? "One moment…" : confirm ? "Turn on alert" : "Turn off alert"}
      </button>
      {state === "error" && error && (
        <p className="alert-hint alert-error" role="alert">
          <WarningCircle size={14} weight="fill" /> {error}
        </p>
      )}
    </div>
  );
}
