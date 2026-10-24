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

export async function getMapEvents(bounds: MapBounds, category?: string): Promise<Event[]> {
  const params = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });
  if (category) params.set("category", category);

  const res = await fetch(`${API_BASE}/events/map?${params}`);
  if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`);

  const json: ApiResponse<Event[]> = await res.json();
  return json.data || [];
}
