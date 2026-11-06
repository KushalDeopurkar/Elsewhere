"use client";

import { useState } from "react";
import { TelegramLogo, EnvelopeSimple, WarningCircle, Check } from "@phosphor-icons/react/ssr";

/**
 * Save a search as an alert, delivered on Telegram or by email.
 *
 * Telegram: creates the alert and hands over a t.me link; pressing Start in
 * Telegram turns it on. Email: sends a confirmation email; the alert only
 * turns on once its owner clicks through, so nobody can sign up someone else.
 */
export default function AlertButton({
  query,
  city,
  hint,
}: {
  query: string;
  city?: string | null;
  /** Shown next to the buttons before either is used. */
  hint?: string;
}) {
  const [tg, setTg] = useState<"idle" | "loading" | "ready">("idle");
  const [tgLink, setTgLink] = useState<string | null>(null);
  const [mail, setMail] = useState<"closed" | "open" | "sending" | "sent">("closed");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const usable = query.trim().length >= 3;

  const telegram = async () => {
    if (!usable) return;
    setTg("loading");
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.link) throw new Error(json.error || "Could not create the alert");
      setTgLink(json.link);
      setTg("ready");
    } catch (e) {
      setError((e as Error).message);
      setTg("idle");
    }
  };

  const sendMail = async () => {
    if (!usable || !email.trim()) return;
    setMail("sending");
    setError(null);
    try {
      const res = await fetch("/api/alerts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send the confirmation email");
      setMail("sent");
    } catch (e) {
      setError((e as Error).message);
      setMail("open");
    }
  };

  return (
    <div className="alert-box">
      <div className="alert-ready">
        {tg === "ready" && tgLink ? (
          <a className="btn btn-primary" href={tgLink} target="_blank" rel="noopener noreferrer">
            <TelegramLogo size={17} weight="fill" /> Open Telegram
          </a>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={telegram} disabled={tg === "loading" || !usable}>
            <TelegramLogo size={17} weight="fill" />
            {tg === "loading" ? "Setting up…" : "Alert me on Telegram"}
          </button>
        )}

        {mail === "closed" && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMail("open")}
            disabled={!usable}
          >
            <EnvelopeSimple size={17} weight="bold" /> Email me
          </button>
        )}

        {tg === "ready" ? (
          <span className="alert-hint">Press Start in Telegram and the alert is on.</span>
        ) : mail === "closed" && hint ? (
          <span className="alert-hint">{hint}</span>
        ) : null}
      </div>

      {(mail === "open" || mail === "sending") && (
        <form
          className="alert-email"
          onSubmit={(e) => {
            e.preventDefault();
            sendMail();
          }}
        >
          <input
            type="email"
            className="alert-email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address for alerts"
            autoComplete="email"
            required
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={mail === "sending"}>
            {mail === "sending" ? "Sending…" : "Send"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMail("closed")}>
            Cancel
          </button>
        </form>
      )}

      {mail === "sent" && (
        <p className="alert-hint">
          <Check size={14} weight="bold" /> Check {email} and click “Turn on this alert”. If it isn&apos;t there, look in spam.
        </p>
      )}

      {error && (
        <p className="alert-hint alert-error" role="alert">
          <WarningCircle size={14} weight="fill" /> {error}
        </p>
      )}
    </div>
  );
}
