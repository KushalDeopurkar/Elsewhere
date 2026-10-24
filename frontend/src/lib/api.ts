import { ApiResponse, Event, SearchParams } from "./types";
import { DEMO_EVENTS } from "./demoEvents";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_BASE = typeof window === "undefined" ? `${BACKEND_URL}/api` : "/api";

export interface EventsResult {
  events: Event[];
  /** True when these came from the bundled sample set, not the API. */
  isSample: boolean;
}

/** Filters that make an empty response meaningful rather than just an empty database. */
function isFiltered(params: SearchParams): boolean {
  return Boolean(params.q || params.category);
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

function sampleFor(params: SearchParams): EventsResult {
  return {
    events: DEMO_EVENTS.filter((e) => matchesLocally(e, params)),
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

  try {
    const res = await fetch(`${API_BASE}/events/search?${qs}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const json: ApiResponse<Event[]> = await res.json();
    const events = json.data || [];

    // An empty result for an unfiltered browse means the database has nothing
    // in it yet, so show the sample set instead of an empty page. An empty
    // result for a real query is a genuine "no matches" and is left alone.
    if (events.length === 0 && !isFiltered(params)) return sampleFor(params);
    return { events, isSample: false };
  } catch {
    return sampleFor(params);
  }
}

export async function getEvent(id: string): Promise<Event | null> {
  try {
    const res = await fetch(`${API_BASE}/events/${id}`);
    if (res.status === 404) {
      return DEMO_EVENTS.find((e) => e.id === id) ?? null;
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const json: ApiResponse<Event> = await res.json();
    return json.data ?? DEMO_EVENTS.find((e) => e.id === id) ?? null;
  } catch {
    return DEMO_EVENTS.find((e) => e.id === id) ?? null;
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
    const res = await fetch(`${API_BASE}/events/map?${qs}`);
    if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`);
    const json: ApiResponse<Event[]> = await res.json();
    const events = json.data || [];
    if (events.length === 0 && !category) return sample();
    return { events, isSample: false };
  } catch {
    return sample();
  }
}
