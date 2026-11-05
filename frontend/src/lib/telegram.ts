/**
 * Telegram Bot API helpers (server only).
 */

import { createHash } from "node:crypto";
import { Event } from "./types";
import { NotConfiguredError } from "./supabaseServer";
import { hasTime } from "./formatDate";

// Overridable only so the flow can be tested against a local stand-in.
const API = (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!t) throw new NotConfiguredError("TELEGRAM_BOT_TOKEN");
  return t;
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export class TelegramError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = "TelegramError";
  }
}

export async function tg<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: T;
    description?: string;
    error_code?: number;
  };
  if (!json.ok) {
    throw new TelegramError(json.error_code ?? res.status, json.description ?? `Telegram ${method} failed`);
  }
  return json.result as T;
}

let username: string | null = null;

export async function botUsername(): Promise<string> {
  if (username) return username;
  const me = await tg<{ username: string }>("getMe");
  username = me.username;
  return username;
}

/**
 * Secret Telegram echoes back on every webhook call. Derived from the bot
 * token, so there is no second secret to configure.
 */
export function webhookSecret(): string {
  return createHash("sha256").update(`eventengine-webhook:${token()}`).digest("hex").slice(0, 48);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

function price(e: Event): string {
  if (e.is_free) return "Free";
  if (e.price_min == null) return "Tickets on listing";
  return `₹${Math.round(e.price_min)}${e.price_max && e.price_max > e.price_min ? "+" : ""}`;
}

/** One event as a compact HTML block for a Telegram message. */
export function eventBlock(e: Event, origin: string): string {
  const where = [e.location_name, e.city].filter(Boolean).join(", ");
  const link = `${origin}/events/${e.id}`;
  return [
    `<b>${escapeHtml(e.title)}</b>`,
    escapeHtml(
      [
        hasTime(e.start_time)
          ? whenFmt.format(new Date(e.start_time))
          : `${dateFmt.format(new Date(e.start_time))}, time on listing`,
        where,
        price(e),
      ]
        .filter(Boolean)
        .join(" · "),
    ),
    `<a href="${link}">Details</a>`,
  ].join("\n");
}

export async function sendMessage(chatId: number, html: string): Promise<void> {
  await tg("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, 4000),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}
