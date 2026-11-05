/**
 * Telegram alerts for saved searches (server only).
 *
 * Flow:
 *  1. The site creates an alert for a request ("free AI meetups in Bengaluru")
 *     and hands back a t.me deep link carrying a one-time token.
 *  2. Pressing Start in Telegram sends /start <token> to the webhook, which
 *     binds the chat and replies at once with what matches today.
 *  3. After every scrape, runAlerts() sends each chat the newly listed events
 *     that match its alerts by meaning. Deliveries are recorded, so an event
 *     is never sent twice and re-running is harmless.
 *
 * Typing any request straight to the bot also creates an alert.
 */

import { randomBytes } from "node:crypto";
import { Event } from "./types";
import { rest } from "./supabaseServer";
import { embedQuery, matchEvents, vectorLiteral, SemanticEvent } from "./semantic";
import { detectCity, cityByName, DEFAULT_CITY } from "./cities";
import { botUsername, eventBlock, escapeHtml, sendMessage, TelegramError } from "./telegram";

/**
 * Alerts should be precise: on live data gte-small scores real matches
 * 0.84-0.90 and unrelated events up to about 0.82.
 */
function minSimilarity(): number {
  const v = Number(process.env.ALERT_MIN_SIMILARITY);
  return Number.isFinite(v) && v > 0 && v < 1 ? v : 0.84;
}
const PREVIEW_MIN = () => minSimilarity() - 0.02;
const HORIZON_DAYS = 21;
const MAX_ALERTS_PER_CHAT = 10;

interface AlertRow {
  id: string;
  query: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  query_embedding: string;
  telegram_chat_id: number | null;
  link_token: string;
  active: boolean;
  created_at: string;
  last_checked_at: string | null;
}

function placeFor(query: string, cityHint?: string | null) {
  const detected = detectCity(query);
  if (detected) return detected.city;
  if (cityHint && cityHint.toLowerCase() === "online") return null;
  return cityByName(cityHint) ?? DEFAULT_CITY;
}

export async function createAlert(input: {
  query: string;
  city?: string | null;
  chatId?: number | null;
}): Promise<AlertRow> {
  const query = input.query.trim().replace(/\s+/g, " ").slice(0, 300);
  if (query.length < 3) throw new Error("Describe what to watch for, e.g. \"free AI meetups in Bengaluru\".");
  const place = placeFor(query, input.city);
  const embedding = await embedQuery(query);
  const rows = await rest<AlertRow[]>("alerts", {
    method: "POST",
    prefer: "return=representation",
    body: {
      query,
      city: place?.name ?? null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      query_embedding: vectorLiteral(embedding),
      telegram_chat_id: input.chatId ?? null,
      link_token: randomBytes(12).toString("base64url"),
    },
  });
  return rows[0];
}

export async function alertLink(alert: AlertRow): Promise<string> {
  return `https://t.me/${await botUsername()}?start=${alert.link_token}`;
}

async function matchesFor(alert: AlertRow, minSim: number, count: number): Promise<SemanticEvent[]> {
  return matchEvents({
    embedding: alert.query_embedding,
    lat: alert.lat,
    lng: alert.lng,
    radiusKm: alert.radius_km,
    from: new Date(),
    to: new Date(Date.now() + HORIZON_DAYS * 86_400_000),
    count,
    minSimilarity: minSim,
  });
}

async function delivered(alertId: string): Promise<Set<string>> {
  const rows = await rest<{ event_id: string }[]>(
    `alert_deliveries?select=event_id&alert_id=eq.${alertId}`,
  );
  return new Set(rows.map((r) => r.event_id));
}

async function recordDeliveries(alertId: string, events: Event[]): Promise<void> {
  if (events.length === 0) return;
  await rest("alert_deliveries?on_conflict=alert_id,event_id", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: events.map((e) => ({ alert_id: alertId, event_id: e.id })),
  });
}

function scopeLabel(alert: AlertRow): string {
  return alert.city ? ` in ${alert.city}` : "";
}

/** Bind a chat to an alert and send what already matches. */
async function activate(alert: AlertRow, chatId: number, origin: string): Promise<void> {
  await rest(`alerts?id=eq.${alert.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { telegram_chat_id: chatId, active: true, last_checked_at: new Date().toISOString() },
  });

  const now = await matchesFor(alert, PREVIEW_MIN(), 3);
  const head = `Alert on: <b>${escapeHtml(alert.query)}</b>${escapeHtml(scopeLabel(alert))}\nI'll message you when new events like this are listed.`;
  if (now.length === 0) {
    await sendMessage(chatId, `${head}\n\nNothing matches right now. I check after every update (every 6 hours).`);
  } else {
    await sendMessage(
      chatId,
      `${head}\n\nAlready on:\n\n${now.map((e) => eventBlock(e, origin)).join("\n\n")}`,
    );
    await recordDeliveries(alert.id, now);
  }
}

const HELP =
  "Tell me what you're looking for and I'll message you when matching events are listed.\n\n" +
  "Just type it, for example:\n<i>free AI meetups in Bengaluru</i>\n<i>comedy in Andheri</i>\n\n" +
  "/list shows your alerts\n/stop turns them all off";

interface TgMessage {
  chat: { id: number; type: string };
  text?: string;
}

export async function handleMessage(msg: TgMessage, origin: string): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (!text) return;

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendMessage(chatId, `Hi! I'm the EventEngine alerts bot.\n\n${HELP}`);
      return;
    }
    const rows = await rest<AlertRow[]>(
      `alerts?select=*&link_token=eq.${encodeURIComponent(token)}&limit=1`,
    );
    const alert = rows[0];
    if (!alert) {
      await sendMessage(chatId, `That link has expired. ${HELP}`);
      return;
    }
    if (alert.telegram_chat_id && alert.telegram_chat_id !== chatId) {
      await sendMessage(chatId, "That alert belongs to another chat. Create your own on the site, or just type what you want here.");
      return;
    }
    await activate(alert, chatId, origin);
    return;
  }

  if (text === "/list") {
    const rows = await rest<AlertRow[]>(
      `alerts?select=query,city&telegram_chat_id=eq.${chatId}&active=eq.true&order=created_at`,
    );
    await sendMessage(
      chatId,
      rows.length
        ? `Your alerts:\n${rows.map((r, i) => `${i + 1}. ${escapeHtml(r.query)}${r.city ? ` (${escapeHtml(r.city)})` : ""}`).join("\n")}\n\n/stop turns them all off.`
        : `You have no alerts. ${HELP}`,
    );
    return;
  }

  if (text === "/stop") {
    await rest(`alerts?telegram_chat_id=eq.${chatId}&active=eq.true`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { active: false },
    });
    await sendMessage(chatId, "All alerts are off. Type a new request any time to start again.");
    return;
  }

  if (text === "/help" || text.startsWith("/")) {
    await sendMessage(chatId, HELP);
    return;
  }

  // Plain text: a new alert for this chat.
  if (text.length < 3) {
    await sendMessage(chatId, HELP);
    return;
  }
  const existing = await rest<{ id: string }[]>(
    `alerts?select=id&telegram_chat_id=eq.${chatId}&active=eq.true`,
  );
  if (existing.length >= MAX_ALERTS_PER_CHAT) {
    await sendMessage(chatId, `You already have ${MAX_ALERTS_PER_CHAT} alerts. /stop clears them.`);
    return;
  }
  const alert = await createAlert({ query: text, chatId });
  await activate(alert, chatId, origin);
}

/** Send every active alert its newly listed matches. Safe to run repeatedly. */
export async function runAlerts(origin: string): Promise<{ alerts: number; messages: number; events: number; errors: number }> {
  const alerts = await rest<AlertRow[]>(
    "alerts?select=*&active=eq.true&telegram_chat_id=not.is.null&order=created_at",
  );
  let messages = 0;
  let events = 0;
  let errors = 0;

  for (const alert of alerts) {
    const checkedAt = new Date().toISOString();
    try {
      const since = Date.parse(alert.last_checked_at ?? alert.created_at);
      const already = await delivered(alert.id);
      const fresh = (await matchesFor(alert, minSimilarity(), 15))
        .filter((e) => !already.has(e.id) && Date.parse(e.created_at) > since)
        .slice(0, 5);

      if (fresh.length > 0) {
        await sendMessage(
          alert.telegram_chat_id!,
          `New for <b>${escapeHtml(alert.query)}</b>${escapeHtml(scopeLabel(alert))}:\n\n${fresh
            .map((e) => eventBlock(e, origin))
            .join("\n\n")}`,
        );
        await recordDeliveries(alert.id, fresh);
        messages += 1;
        events += fresh.length;
      }

      await rest(`alerts?id=eq.${alert.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { last_checked_at: checkedAt },
      });
    } catch (err) {
      errors += 1;
      // The person blocked the bot or deleted the chat: stop trying.
      if (err instanceof TelegramError && (err.code === 403 || /chat not found/i.test(err.message))) {
        await rest(`alerts?telegram_chat_id=eq.${alert.telegram_chat_id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: { active: false },
        }).catch(() => {});
      }
      console.warn("[alerts]", alert.id, (err as Error).message);
    }
  }

  return { alerts: alerts.length, messages, events, errors };
}
