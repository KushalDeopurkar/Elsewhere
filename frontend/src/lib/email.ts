/**
 * Transactional email through Brevo's HTTP API (server only).
 *
 * Brevo's free plan sends 300 emails a day from a single verified sender
 * address (a Gmail address works), so no domain setup is needed.
 */

import { Event } from "./types";
import { NotConfiguredError } from "./supabaseServer";
import { hasTime } from "./formatDate";

// Overridable only so the flow can be tested against a local stand-in.
const API = (process.env.BREVO_API_BASE || "https://api.brevo.com/v3").replace(/\/$/, "");

export function emailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.ALERT_EMAIL_FROM?.trim());
}

function config(): { key: string; from: string } {
  const key = process.env.BREVO_API_KEY?.trim();
  const from = process.env.ALERT_EMAIL_FROM?.trim();
  if (!key) throw new NotConfiguredError("BREVO_API_KEY");
  if (!from) throw new NotConfiguredError("ALERT_EMAIL_FROM");
  return { key, from };
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adds List-Unsubscribe headers, so mail apps show their own button. */
  unsubscribeUrl?: string;
}): Promise<void> {
  const { key, from } = config();
  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await fetch(`${API}/smtp/email`, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "EventEngine", email: from },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const whenFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
});

function when(e: Event): string {
  return hasTime(e.start_time)
    ? whenFmt.format(new Date(e.start_time))
    : `${dateFmt.format(new Date(e.start_time))}, time on listing`;
}

function price(e: Event): string {
  if (e.is_free) return "Free";
  if (e.price_min == null) return "Tickets on listing";
  return `₹${Math.round(e.price_min)}${e.price_max && e.price_max > e.price_min ? "+" : ""}`;
}

function detailLine(e: Event): string {
  return [when(e), [e.location_name, e.city].filter(Boolean).join(", "), price(e)]
    .filter(Boolean)
    .join(" · ");
}

const C = {
  bg: "#181411",
  card: "#221d19",
  ink: "#f6f3f0",
  mid: "#cdc6bf",
  low: "#a39b93",
  accent: "#f5b83d",
};

function layout(inner: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${C.ink};">
<tr><td style="padding:0 4px 18px;font-size:18px;font-weight:700;">Event<span style="color:${C.accent};">Engine</span></td></tr>
${inner}
<tr><td style="padding:22px 4px 0;font-size:12px;line-height:1.6;color:${C.low};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function eventRows(events: Event[], origin: string): string {
  return events
    .map(
      (e) => `<tr><td style="padding:0 0 10px;">
<a href="${origin}/events/${e.id}" style="display:block;text-decoration:none;background:${C.card};border-radius:12px;padding:14px 16px;">
<span style="display:block;font-size:16px;font-weight:600;color:${C.ink};">${escapeHtml(e.title)}</span>
<span style="display:block;margin-top:4px;font-size:13px;color:${C.mid};">${escapeHtml(detailLine(e))}</span>
</a></td></tr>`,
    )
    .join("");
}

function eventText(events: Event[], origin: string): string {
  return events.map((e) => `- ${e.title}\n  ${detailLine(e)}\n  ${origin}/events/${e.id}`).join("\n\n");
}

function scope(query: string, city: string | null): string {
  return `“${query}”${city ? ` in ${city}` : ""}`;
}

export function confirmEmail(o: { query: string; city: string | null; confirmUrl: string }) {
  const what = scope(o.query, o.city);
  return {
    subject: `Confirm your EventEngine alert: ${o.query}`.slice(0, 120),
    html: layout(
      `<tr><td style="padding:0 4px;font-size:15px;line-height:1.6;color:${C.mid};">
You asked to get an email when new events matching <b style="color:${C.ink};">${escapeHtml(what)}</b> are listed.
</td></tr>
<tr><td style="padding:20px 4px;"><a href="${o.confirmUrl}" style="display:inline-block;background:${C.accent};color:#1d1712;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;">Turn on this alert</a></td></tr>`,
      "If you didn't ask for this, ignore this email and nothing more will be sent.",
    ),
    text: `You asked to get an email when new events matching ${what} are listed.\n\nTurn on this alert: ${o.confirmUrl}\n\nIf you didn't ask for this, ignore this email and nothing more will be sent.`,
  };
}

export function matchesEmail(o: {
  kind: "welcome" | "new";
  query: string;
  city: string | null;
  events: Event[];
  origin: string;
  unsubscribeUrl: string;
}) {
  const what = scope(o.query, o.city);
  const lead =
    o.kind === "welcome"
      ? o.events.length
        ? `Your alert for ${what} is on. Here's what's already listed:`
        : `Your alert for ${what} is on. Nothing matches right now; you'll get an email when something does.`
      : `New events for ${what}:`;
  const subject =
    o.kind === "welcome"
      ? `Alert on: ${o.query}`
      : `${o.events.length} new event${o.events.length === 1 ? "" : "s"} for ${o.query}`;
  const footer = `You're getting this because you turned on an EventEngine alert for ${escapeHtml(what)}. <a href="${o.unsubscribeUrl}" style="color:${C.low};">Turn off this alert</a>.`;
  return {
    subject: subject.slice(0, 120),
    html: layout(
      `<tr><td style="padding:0 4px 14px;font-size:15px;line-height:1.6;color:${C.mid};">${escapeHtml(lead)}</td></tr>${eventRows(o.events, o.origin)}`,
      footer,
    ),
    text: `${lead}\n\n${eventText(o.events, o.origin)}\n\nTurn off this alert: ${o.unsubscribeUrl}`,
  };
}
