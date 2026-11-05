"use client";

import { useState } from "react";
import { TelegramLogo, WarningCircle } from "@phosphor-icons/react/ssr";

/**
 * "Alert me on Telegram": creates a saved search and hands over a t.me link.
 * Pressing Start in Telegram turns it on and sends what already matches.
 */
export default function AlertButton({
  query,
  city,
  compact = false,
  hint,
}: {
  query: string;
  city?: string | null;
  compact?: boolean;
  /** Shown next to the button before it is used. */
  hint?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (query.trim().length < 3) return;
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.link) throw new Error(json.error || "Could not create the alert");
      setLink(json.link);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };

  if (state === "ready" && link) {
    return (
      <span className="alert-ready">
        <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer">
          <TelegramLogo size={17} weight="fill" /> Open Telegram
        </a>
        <span className="alert-hint">Press Start in Telegram and the alert is on.</span>
      </span>
    );
  }

  return (
    <span className="alert-ready">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={create}
        disabled={state === "loading" || query.trim().length < 3}
      >
        <TelegramLogo size={17} weight="fill" />
        {state === "loading" ? "Setting up…" : compact ? "Alert me" : "Alert me on Telegram"}
      </button>
      {state !== "error" && hint && <span className="alert-hint">{hint}</span>}
      {state === "error" && error && (
        <span className="alert-hint alert-error">
          <WarningCircle size={14} weight="fill" /> {error}
        </span>
      )}
    </span>
  );
}
