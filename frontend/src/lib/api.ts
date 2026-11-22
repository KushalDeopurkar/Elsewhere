import { ApiResponse, Event, SearchParams } from "./types";
import { DEMO_EVENTS } from "./demoEvents";
import { kmBetween } from "./geo";

import { decodeEntities } from "./text";
import { dedupeEvents, displayTitle } from "./tidy";

export function clean(e: Event): Event {
  return {
    ...e,
    title: displayTitle(decodeEntities(e.title)),
    description: e.description ? decodeEntities(e.description) : e.description,
    location_name: e.location_name ? decodeEntities(e.location_name) : e.location_name,
    // An empty picture means the event's page was checked and has none.
    image_url: e.image_url || null,
  };
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_BASE = typeof window === "undefined" ? `${BACKEND_URL}/api` : "/api";

export interface EventsResult {
  events: Event[];
  /** True when these came from the bundled sample set, not the API. */
  isSample: boolean;
  /** The server filled the page: there are more events than these. */
  more?: boolean;
}

/**
 * The bundled sample set is for local development only. In production a
 * failed fetch is an error (shown as such, and retried), never fake events.
 */
const DEMO_ALLOWED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_DATA === "1";

/**
 * Fetch with quick retries on a server error or a dropped connection (a
 * waking backend). Each try gives up after `timeoutMs`, so a stuck request
 * can't hold a page on its loading state.
 */
async function fetchRetry(url: string, init?: RequestInit, delays = [600, 1800], timeoutMs = 12_000): Promise<Response> {
  let last: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      const res = await fetch(url, init?.signal ? init : { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status < 500) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    if (i < delays.length) await new Promise((r) => setTimeout(r, delays[i]));
  }
  throw last instanceof Error ? last : new Error("Listings could not be reached");
}

/** Filters that make an empty response meaningful rather than just an empty database. */
function isFiltered(params: SearchParams): boolean {
  return Boolean(params.q || params.category || params.from || params.to);
}

function matchesLocally(event: Event, params: SearchParams): boolean {
  if (params.category && event.category !== params.category) return false;
  if (params.q) {
    const haystack = [
      event.title,
      event.description,
      event.location_name,
      event.address,
      event.city,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(params.q.toLowerCase())) return false;
  }
  return true;
}

/** Like the API: within the search radius of the point; online events go everywhere. */
function nearLocally(event: Event, params: SearchParams): boolean {
  if (params.lat == null || params.lng == null) return true;
  if (event.format === "online" || event.lat == null || event.lng == null) return true;
  return kmBetween(params.lat, params.lng, event.lat, event.lng) <= (params.radius_km ?? 40);
}

function sampleFor(params: SearchParams): EventsResult {
  return {
    events: DEMO_EVENTS.filter((e) => matchesLocally(e, params) && nearLocally(e, params)),
    isSample: true,
  };
}

export async function searchEvents(params: SearchParams): Promise<EventsResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.lat != null) qs.set("lat", String(params.lat));
  if (params.lng != null) qs.set("lng", String(params.lng));
  if (params.radius_km) qs.set("radius_km", String(params.radius_km));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  if (params.from) qs.set("from_time", params.from);
  if (params.to) qs.set("to_time", params.to);
  // Lists need a snippet, not the whole write-up: the event page loads that.
  qs.set("desc_chars", "280");

  const limit = params.limit ?? 100;
  try {
    // One retry: the page's own retries (useCityEvents) take it from there.
    const res = await fetchRetry(`${API_BASE}/events/search?${qs}`, undefined, [1500]);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const json: ApiResponse<Event[]> = await res.json();
    const raw = json.data || [];
    const events = dedupeEvents(raw.map(clean));
    // Locally, an empty unfiltered browse means an empty database: the
    // sample set stands in. In production an empty answer is an answer.
    if (DEMO_ALLOWED && events.length === 0 && !isFiltered(params)) return sampleFor(params);
    return { events, isSample: false, more: raw.length >= limit };
  } catch (e) {
    if (DEMO_ALLOWED) return sampleFor(params);
    throw e instanceof Error ? e : new Error("Listings could not be reached");
  }
}

/**
 * One event, or null when it doesn't exist. Throws when the listings can't
 * be reached, so a page can tell "not found" (404) from "try again".
 */
export async function getEvent(id: string): Promise<Event | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return DEMO_ALLOWED ? (DEMO_EVENTS.find((e) => e.id === id) ?? null) : null;
  }
  try {
    const res = await fetchRetry(`${API_BASE}/events/${id}`, typeof window === "undefined" ? { next: { revalidate: 300 } } : undefined);
    if (res.status === 404 || res.status === 422) return DEMO_ALLOWED ? (DEMO_EVENTS.find((e) => e.id === id) ?? null) : null;
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const json: ApiResponse<Event> = await res.json();
    return json.data ? clean(json.data) : null;
  } catch (e) {
    const demo = DEMO_EVENTS.find((x) => x.id === id);
    if (DEMO_ALLOWED && demo) return demo;
    throw e instanceof Error ? e : new Error("Listings could not be reached");
  }
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

function withinBounds(event: Event, b: MapBounds): boolean {
  if (event.lat == null || event.lng == null) return false;
  return (
    event.lat >= b.south &&
    event.lat <= b.north &&
    event.lng >= b.west &&
    event.lng <= b.east
  );
}

export async function getMapEvents(
  bounds: MapBounds,
  category?: string,
  signal?: AbortSignal,
): Promise<EventsResult> {
  const qs = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });
  if (category) qs.set("category", category);

  const sample = (): EventsResult => ({
    events: DEMO_EVENTS.filter(
      (e) => withinBounds(e, bounds) && (!category || e.category === category),
    ),
    isSample: true,
  });

  try {
    const res = await fetchRetry(`${API_BASE}/events/map?${qs}`, { signal });
    if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`);
    const json: ApiResponse<Event[]> = await res.json();
    const events = dedupeEvents((json.data || []).map(clean));
    if (DEMO_ALLOWED && events.length === 0 && !category) return sample();
    return { events, isSample: false };
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    if (DEMO_ALLOWED) return sample();
    throw e instanceof Error ? e : new Error("Map listings could not be reached");
  }
}
