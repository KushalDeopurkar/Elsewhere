import { ApiResponse, Event, SearchParams } from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const API_BASE = typeof window === "undefined" ? `${BACKEND_URL}/api` : "/api";

export async function searchEvents(params: SearchParams): Promise<Event[]> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.category) searchParams.set("category", params.category);
  if (params.lat) searchParams.set("lat", String(params.lat));
  if (params.lng) searchParams.set("lng", String(params.lng));
  if (params.radius_km) searchParams.set("radius_km", String(params.radius_km));
  if (params.from_time) searchParams.set("from_time", params.from_time);
  if (params.to_time) searchParams.set("to_time", params.to_time);
  // Only send the facets when set — the API treats absence as "no constraint",
  // so sending `false` would wrongly narrow to paid / in-person only.
  if (params.free_only != null) searchParams.set("free_only", String(params.free_only));
  if (params.online_only != null) searchParams.set("online_only", String(params.online_only));
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE}/events/search?${searchParams}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const json: ApiResponse<Event[]> = await res.json();
  return json.data || [];
}

export async function getEvent(id: string): Promise<Event | null> {
  const res = await fetch(`${API_BASE}/events/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const json: ApiResponse<Event> = await res.json();
  return json.data;
}

export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapQuery {
  category?: string;
  /** ISO timestamps bounding the day or window shown on the map. */
  from_time?: string;
  to_time?: string;
  /** Keyword, matched against the same index the main feed searches. */
  q?: string;
}

export async function getMapEvents(
  bounds: MapBounds,
  query: MapQuery = {}
): Promise<Event[]> {
  const params = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });
  if (query.category) params.set("category", query.category);
  if (query.from_time) params.set("from_time", query.from_time);
  if (query.to_time) params.set("to_time", query.to_time);
  if (query.q) params.set("q", query.q);

  const res = await fetch(`${API_BASE}/events/map?${params}`);
  if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`);

  const json: ApiResponse<Event[]> = await res.json();
  return json.data || [];
}
