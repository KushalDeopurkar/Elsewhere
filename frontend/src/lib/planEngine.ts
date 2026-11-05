/**
 * Server-side day planner.
 *
 * 1. Work out the city (and area) from the request, fetch upcoming events in
 *    a radius around it from the existing search endpoint.
 * 2. Shortlist ~40 candidates with cheap keyword scoring.
 * 3. Ask a free LLM (Groq or Gemini, both via their OpenAI-compatible API) to
 *    pick and justify 2–4 stops, referring to candidates by short ids so it
 *    cannot invent an event.
 * 4. Re-check the picks in code: real ids only, no clashes once travel time is
 *    counted, within budget. The model proposes; the schedule disposes.
 *
 * With no API key, or if the model call fails, a rules planner produces the
 * plan instead, so the feature never goes dark during a demo.
 */

import { Event, EventCategory } from "./types";
import { searchEvents } from "./api";
import { parseIntent } from "./intent";
import { detectCity, cityByName, DEFAULT_CITY, CityPoint } from "./cities";
import { buildSchedule, parseBudget, lowestPrice, PlanResult } from "./plan";

const ZONE = "Asia/Kolkata";
const SHORTLIST = 30;

// ---------------------------------------------------------------------------
// Dates (IST)
// ---------------------------------------------------------------------------

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long" });
const longFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true,
});
const slotFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, weekday: "short", day: "numeric", month: "short",
  hour: "numeric", minute: "2-digit", hour12: true,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true,
});

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "numeric", hourCycle: "h23" });

/** [fromHour, toHour, label] for "morning", "shaam", "tonight" and friends. */
function partOfDay(text: string): [number, number, string] | null {
  const q = text.toLowerCase();
  if (/\b(morning|subah|breakfast|sunrise)\b/.test(q)) return [5, 12, "In the morning"];
  if (/\b(afternoon|dopahar|lunch)\b/.test(q)) return [12, 17, "In the afternoon"];
  if (/\b(evening|shaam|sham|sunset|after work)\b/.test(q)) return [16, 21, "In the evening"];
  if (/\b(night|tonight|raat|late)\b/.test(q)) return [19, 24, "At night"];
  return null;
}

const dayKey = (ms: number) => dayKeyFmt.format(new Date(ms));
const DAY_MS = 86_400_000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The IST date the request is about, or null when it does not say. */
function requestedDay(text: string, now: number): string | null {
  const q = ` ${text.toLowerCase()} `;
  const todayName = weekdayFmt.format(new Date(now)).toLowerCase();
  const todayIdx = WEEKDAYS.indexOf(todayName);

  if (/\b(today|tonight|aaj|abhi|this evening)\b/.test(q)) return dayKey(now);
  if (/\b(day after tomorrow|parso|parson)\b/.test(q)) return dayKey(now + 2 * DAY_MS);
  if (/\b(tomorrow|kal)\b/.test(q)) return dayKey(now + DAY_MS);

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i];
    if (new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).test(q)) {
      const ahead = (i - todayIdx + 7) % 7;
      return dayKey(now + ahead * DAY_MS);
    }
  }
  if (/\b(weekend|saturday|sunday)\b/.test(q)) {
    const ahead = todayIdx === 0 ? 0 : (6 - todayIdx + 7) % 7;
    return dayKey(now + ahead * DAY_MS);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shortlisting
// ---------------------------------------------------------------------------

/** Words the shared intent parser does not know, including common Hinglish. */
const EXTRA_INTERESTS: [EventCategory, string[]][] = [
  ["arts", ["comedy", "standup", "stand-up", "stand up", "open mic", "natak", "play", "drama", "improv"]],
  ["food", ["khana", "khaana", "eat", "foodie", "street food", "biryani", "cafe"]],
  ["music", ["gaana", "gaane", "sangeet", "dance", "jam", "karaoke", "live music"]],
  ["nightlife", ["night out", "drinks", "pub"]],
  ["outdoor", ["ghoomna", "beach", "sunset", "trail"]],
  ["tech", ["meetup", "hackathon"]],
];

interface Shortlisted {
  event: Event;
  score: number;
  reasons: string[];
}

function interestsFor(text: string): EventCategory[] {
  const intent = parseIntent(text);
  const set = new Set<EventCategory>(intent.interests);
  const q = ` ${text.toLowerCase()} `;
  for (const [cat, words] of EXTRA_INTERESTS) {
    if (words.some((w) => q.includes(` ${w}`))) set.add(cat);
  }
  return [...set];
}

function shortlist(
  events: Event[],
  text: string,
  day: string | null,
  area: string | null,
  budget: number | null,
): Shortlisted[] {
  const interests = interestsFor(text);
  const intent = parseIntent(text);
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

  return events
    .map((event) => {
      let score = 0;
      const reasons: string[] = [];
      if (interests.includes(event.category)) {
        score += 3;
        reasons.push("Matches what you asked for");
      }
      if (day && dayKey(Date.parse(event.start_time)) === day) {
        score += 4;
        reasons.push("On the day you asked for");
      }
      const part = partOfDay(text);
      if (part) {
        const hour = Number(hourFmt.format(new Date(event.start_time)));
        if (hour >= part[0] && hour < part[1]) {
          score += 2;
          reasons.push(part[2]);
        }
      }
      if (area) {
        const where = `${event.location_name ?? ""} ${event.address ?? ""}`.toLowerCase();
        if (where.includes(area)) {
          score += 3;
          reasons.push(`In ${area.replace(/\b\w/g, (c) => c.toUpperCase())}`);
        }
      }
      if (intent.freeOnly || budget != null) {
        const price = lowestPrice(event);
        if (event.is_free) {
          score += 2;
          reasons.push("Free entry");
        } else if (budget != null && price <= budget) {
          score += 1;
        } else if (intent.freeOnly || (budget != null && price > budget)) {
          score -= 4;
        }
      }
      const hay = `${event.title} ${event.description ?? ""}`.toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      score += Math.min(hits, 3);
      return { event, score, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.event.start_time) - Date.parse(b.event.start_time),
    );
}

// ---------------------------------------------------------------------------
// LLM (free tier, OpenAI-compatible)
// ---------------------------------------------------------------------------

interface LlmConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  prefer: RegExp[];
}

const GROQ_URL = "https://api.groq.com/openai/v1";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

function llmConfig(): LlmConfig | null {
  const override = process.env.PLANNER_MODEL;
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "Groq",
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: (process.env.PLANNER_BASE_URL || GROQ_URL).replace(/\/$/, ""),
      model: override || "llama-3.3-70b-versatile",
      // Fast, non-reasoning models first: they answer in about a second and
      // use far fewer tokens, which matters on a per-minute free quota.
      prefer: [/llama-4-maverick/, /llama-4-scout/, /llama-3\.3-70b/, /kimi-k2/, /gpt-oss-120b/, /gpt-oss-20b/, /qwen/, /llama/],
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "Gemini",
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: GEMINI_URL,
      model: override || "gemini-2.5-flash",
      prefer: [/gemini-[\d.]+-flash$/, /gemini-[\d.]+-flash(?!.*(lite|image|tts|live|audio))/, /flash/],
    };
  }
  if (process.env.PLANNER_API_KEY) {
    return {
      provider: "AI",
      apiKey: process.env.PLANNER_API_KEY,
      baseUrl: (process.env.PLANNER_BASE_URL || GROQ_URL).replace(/\/$/, ""),
      model: override || "llama-3.3-70b-versatile",
      prefer: [/./],
    };
  }
  return null;
}

/** Ranked chat models the provider serves, cached on a warm function. */
let modelCache: { ids: string[]; at: number } | null = null;

// Free tiers list speech, embedding and safety models alongside chat ones.
const NOT_CHAT = /whisper|tts|embed|guard|moderation|playai|orpheus|image|audio|live|vision|distil|aqa|compound|safeguard/i;

async function rankedModels(cfg: LlmConfig): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.at < 10 * 60_000) return modelCache.ids;
  let ids: string[] = [];
  try {
    const res = await fetch(`${cfg.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { id: string }[] };
      const all = (json.data ?? [])
        .map((m) => m.id.replace(/^models\//, ""))
        .filter((id) => !NOT_CHAT.test(id));
      const ranked: string[] = [];
      for (const re of cfg.prefer) {
        for (const id of all) if (re.test(id) && !ranked.includes(id)) ranked.push(id);
      }
      ids = ranked.length ? ranked : all;
    }
  } catch {
    // Listing is best effort; fall back to the configured model alone.
  }
  // An explicit PLANNER_MODEL always goes first.
  const order = [cfg.model, ...ids.filter((id) => id !== cfg.model)];
  const result = process.env.PLANNER_MODEL ? order : ids.length ? ids : [cfg.model];
  // Only cache a real listing, so one failed lookup does not pin us for ten minutes.
  if (ids.length) modelCache = { ids: result, at: Date.now() };
  return result;
}

/** Reasoning models spend their token budget thinking unless told not to. */
const REASONING = /gpt-oss|qwen3|deepseek-r1|gemini-2\.5|gemini-3|magistral|\bo\d/i;

async function chat(cfg: LlmConfig, model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: REASONING.test(model) ? 2500 : 900,
      ...(REASONING.test(model) ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`LLM ${res.status} on ${model}: ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

interface LlmPlan {
  title?: string;
  summary?: string;
  note?: string | null;
  stops?: { id?: string; why?: string }[];
}

function parseJson(raw: string): LlmPlan | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as LlmPlan;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as LlmPlan;
    } catch {
      return null;
    }
  }
}

function priceText(e: Event): string {
  if (e.is_free) return "free";
  if (e.price_min == null) return "price n/a";
  return `₹${e.price_min}${e.price_max && e.price_max > e.price_min ? "+" : ""}`;
}

const SYSTEM_PROMPT = `You are the day planner inside EventEngine, an event discovery app for India.
The user describes the day they want. You build an itinerary from the CANDIDATES list only.

Rules:
- Pick 2 to 4 candidates (fewer only if fewer genuinely fit). Use their ids exactly as given (e.g. "c7").
- The plan must be attendable: no overlapping times, leave travel time between venues, prefer stops close together.
- Respect the day, time of day, area, interests and budget the user asked for. Total ticket cost must stay within any budget.
- Prefer a varied, fun sequence (e.g. a workshop, then food, then music) when the request allows.
- Never invent events, venues, prices or times.
- Write in the user's register: if they wrote Hinglish, reply in Hinglish (Latin script); otherwise plain English. Keep it warm and short.

Reply with JSON only:
{"title": "catchy plan name, max 6 words",
 "summary": "one sentence describing the day",
 "stops": [{"id": "c3", "why": "max 18 words, why this fits their request"}],
 "note": "one short sentence if something they asked for was not possible, else null"}`;

async function planWithLlm(
  cfg: LlmConfig,
  text: string,
  city: CityPoint,
  area: string | null,
  day: string | null,
  budget: number | null,
  pool: Shortlisted[],
  now: number,
): Promise<{ plan: LlmPlan; model: string; byId: Map<string, Event> }> {
  const byId = new Map<string, Event>();
  const rows = pool.map((s, i) => {
    const id = `c${i + 1}`;
    byId.set(id, s.event);
    const e = s.event;
    const end = e.end_time ? timeFmt.format(new Date(e.end_time)) : "?";
    const venue = (e.location_name || e.address || "").slice(0, 45);
    return `${id} | ${slotFmt.format(new Date(e.start_time))}–${end} | ${e.title.slice(0, 60)} | ${e.category} | ${venue || e.city || "venue n/a"} | ${priceText(e)}`;
  });

  const user = [
    `Now: ${longFmt.format(new Date(now))} IST`,
    `Request: ${text}`,
    `City: ${city.name}${area ? ` (area: ${area})` : ""}`,
    `Day asked for: ${day ? weekdayFmt.format(new Date(`${day}T12:00:00+05:30`)) + " " + day : "not stated, pick the best upcoming day"}`,
    `Budget: ${budget != null ? `₹${budget} total` : "not stated"}`,
    "",
    "CANDIDATES (id | when IST | title | category | venue | price):",
    ...rows,
  ].join("\n");

  // Try models in order. Each Groq model has its own per-minute quota, so a
  // 429 on one usually means the next one is free; a 404 means retired.
  const models = (await rankedModels(cfg)).slice(0, 4);
  const errors: string[] = [];
  for (const model of models) {
    try {
      const raw = await chat(cfg, model, SYSTEM_PROMPT, user);
      const plan = parseJson(raw);
      if (!plan || !Array.isArray(plan.stops)) throw new Error(`Reply from ${model} was not a plan`);
      return { plan, model, byId };
    } catch (err) {
      errors.push((err as Error).message);
      const status = (err as { status?: number }).status;
      // Bad key or bad request body: another model will not help.
      if (status === 401 || status === 403) break;
      // A model that keeps failing should not stay at the front of the queue.
      if (modelCache) modelCache.ids = [...modelCache.ids.filter((m) => m !== model), model];
    }
  }
  throw new Error(errors.join(" | ") || "No model available");
}

// ---------------------------------------------------------------------------
// Rules planner (no key, or the model failed)
// ---------------------------------------------------------------------------

function planWithRules(
  pool: Shortlisted[],
  day: string | null,
  budget: number | null,
): { picks: { event: Event; why: string }[]; day: string | null } {
  let target = day;
  if (!target) {
    // The day whose three best matches score highest.
    const byDay = new Map<string, number[]>();
    for (const s of pool) {
      const k = dayKey(Date.parse(s.event.start_time));
      byDay.set(k, [...(byDay.get(k) ?? []), s.score]);
    }
    let best = -Infinity;
    for (const [k, scores] of byDay) {
      const total = scores.sort((a, b) => b - a).slice(0, 3).reduce((x, y) => x + y, 0);
      if (total > best) {
        best = total;
        target = k;
      }
    }
  }

  const sameDay = pool.filter((s) => dayKey(Date.parse(s.event.start_time)) === target);
  const dayPool = sameDay.length >= 2 ? sameDay : pool;
  // When the request names interests, only fall back to unrelated events if
  // nothing related exists at all.
  const related = dayPool.filter((s) => s.reasons.includes("Matches what you asked for"));
  const source = related.length ? related : dayPool;
  const usedCats = new Set<EventCategory>();
  const picks = [...source]
    // Light variety bonus so the day is not four of the same thing.
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const repeat = usedCats.has(s.event.category);
      usedCats.add(s.event.category);
      return { s, rank: s.score - (repeat ? 1 : 0) };
    })
    .sort((a, b) => b.rank - a.rank)
    .map(({ s }) => ({
      event: s.event,
      why: s.reasons.length ? s.reasons.slice(0, 2).join(" · ") : "A good fit for the day",
    }));

  void budget;
  return { picks, day: target };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function makePlan(input: { prompt: string; city?: string | null }): Promise<PlanResult> {
  const text = input.prompt.trim().slice(0, 400);
  const now = Date.now();

  const detected = detectCity(text);
  const city = detected?.city ?? cityByName(input.city) ?? DEFAULT_CITY;
  const area = detected?.area ?? null;
  const day = requestedDay(text, now);
  const budget = parseBudget(text);

  const { events, isSample } = await searchEvents({
    lat: city.lat,
    lng: city.lng,
    radius_km: 40,
    limit: 100,
  });

  // Upcoming, located, within two weeks. Sample data ignores the radius, so
  // filter it by city name instead.
  const horizon = now + 14 * DAY_MS;
  const upcoming = events.filter((e) => {
    const t = Date.parse(e.start_time);
    if (!(t > now - 30 * 60_000 && t < horizon)) return false;
    if (isSample) return (e.city ?? "").toLowerCase() === city.name.toLowerCase();
    return true;
  });

  const ranked = shortlist(upcoming, text, day, area, budget);
  const pool = ranked.slice(0, SHORTLIST);

  const base = {
    city: city.name,
    isSample,
    considered: upcoming.length,
  };

  if (pool.length === 0) {
    return {
      ...base,
      title: "Nothing to plan yet",
      summary: `No upcoming events found around ${city.name} in the next two weeks.`,
      note: "Try another city or a broader request.",
      stops: [],
      totalCost: 0,
      engine: { kind: "rules", label: "Rules" },
    };
  }

  const cfg = llmConfig();
  if (cfg) {
    try {
      const { plan, model, byId } = await planWithLlm(cfg, text, city, area, day, budget, pool, now);
      const seen = new Set<string>();
      const picks = (plan.stops ?? [])
        .filter((s) => s.id && byId.has(s.id) && !seen.has(s.id) && seen.add(s.id))
        .map((s) => ({ event: byId.get(s.id!)!, why: (s.why ?? "").trim() || "Fits your request" }));

      const { stops, dropped } = buildSchedule(picks, { budget });
      if (stops.length > 0) {
        const notes = [plan.note?.trim() || null];
        if (dropped > 0) notes.push(`${dropped} suggestion${dropped > 1 ? "s" : ""} dropped for clashing times or budget.`);
        return {
          ...base,
          title: plan.title?.trim() || "Your day, planned",
          summary: plan.summary?.trim() || "",
          note: notes.filter(Boolean).join(" ") || null,
          stops,
          totalCost: stops.reduce((sum, s) => sum + lowestPrice(s.event), 0),
          engine: { kind: "ai", label: `${model} · ${cfg.provider}` },
        };
      }
    } catch (err) {
      console.warn("[plan] LLM failed, using rules:", (err as Error).message);
    }
  }

  const { picks, day: target } = planWithRules(pool, day, budget);
  const { stops } = buildSchedule(picks, { budget, maxStops: 3 });
  const dayName = target ? weekdayFmt.format(new Date(`${target}T12:00:00+05:30`)) : "";
  return {
    ...base,
    title: dayName ? `Your ${dayName} in ${city.name}` : `Your day in ${city.name}`,
    summary: `${stops.length} stop${stops.length === 1 ? "" : "s"} picked from ${upcoming.length} upcoming events, ordered so you can make each one.`,
    note: cfg ? "The AI planner is busy, so this plan was built by rules." : null,
    stops,
    totalCost: stops.reduce((sum, s) => sum + lowestPrice(s.event), 0),
    engine: { kind: "rules", label: "Rules" },
  };
}
