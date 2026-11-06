/**
 * Travel time from a starting point to a venue.
 *
 * First choice: /api/travel (TomTom, live traffic, needs TOMTOM_API_KEY).
 * Fallback: OpenStreetMap routing (FOSSGIS OSRM), free and keyless but with
 * no traffic, called straight from the browser. Addresses are looked up
 * with Photon. The result says which source produced it.
 */

export type Mode = "car" | "bike" | "foot" | "transit";

export interface Leg {
  mode: Mode;
  minutes: number;
  km: number;
  /** Minutes added by current traffic (traffic source only). */
  delayMinutes?: number;
}

export interface TravelResult {
  /** "google" / "tomtom": live traffic. "osm": free-flow estimate without traffic. */
  source: "google" | "tomtom" | "osm";
  legs: Leg[];
  /** Driving route as [lng, lat] pairs, for drawing on the map. */
  line: [number, number][];
  /** Latest departure to arrive by the event start, in typical traffic for that time. */
  leaveBy?: { departAt: string; minutes: number } | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const BASE = "https://routing.openstreetmap.de";
/** Live traffic goes stale; keep answers for two minutes. */
const cache = new Map<string, { at: number; p: Promise<TravelResult> }>();

async function route(mode: Mode, from: LatLng, to: LatLng, withLine: boolean) {
  const url =
    `${BASE}/routed-${mode}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=${withLine ? "simplified" : "false"}&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing service answered ${res.status}`);
  const json = await res.json();
  const r = json?.routes?.[0];
  if (json?.code !== "Ok" || !r) throw new Error("No road route between these points");
  return {
    leg: { mode, minutes: Math.max(1, Math.round(r.duration / 60)), km: Math.round(r.distance / 100) / 10 } as Leg,
    line: (withLine ? r.geometry?.coordinates ?? [] : []) as [number, number][],
  };
}

/** Set once the server says traffic routing isn't configured. */
let trafficOff = false;

async function trafficRoute(from: LatLng, to: LatLng, arrive?: string): Promise<TravelResult | null> {
  if (trafficOff) return null;
  const qs = new URLSearchParams({
    from: `${from.lat.toFixed(5)},${from.lng.toFixed(5)}`,
    to: `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
  });
  if (arrive) qs.set("arrive", arrive);
  try {
    const res = await fetch(`/api/travel?${qs}`);
    if (res.status === 501) {
      trafficOff = true;
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.legs?.length ? (json as TravelResult) : null;
  } catch {
    return null;
  }
}

export function travelTimes(from: LatLng, to: LatLng, arrive?: string): Promise<TravelResult> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(",") + (arrive ?? "");
  const cached = cache.get(key);
  let hit = cached && Date.now() - cached.at < 120_000 ? cached.p : undefined;
  if (!hit) {
    hit = (async () => {
      const live = await trafficRoute(from, to, arrive);
      if (live) return live;
      const settled = await Promise.allSettled([
        route("car", from, to, true),
        route("bike", from, to, false),
        route("foot", from, to, false),
      ]);
      const ok = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
      if (!ok.length) {
        const first = settled[0];
        throw first.status === "rejected" ? first.reason : new Error("Routing failed");
      }
      return { source: "osm", legs: ok.map((o) => o.leg), line: ok.find((o) => o.leg.mode === "car")?.line ?? [] };
    })();
    hit.catch(() => cache.delete(key));
    cache.set(key, { at: Date.now(), p: hit });
  }
  return hit;
}

export interface GeoHit {
  label: string;
  lat: number;
  lng: number;
}

/** Address search limited to India, biased toward the given point. */
export async function geocode(q: string, near?: LatLng): Promise<GeoHit[]> {
  const qs = new URLSearchParams({ q, limit: "6", lang: "en", bbox: "68.1,6.5,97.5,35.7" });
  if (near) {
    qs.set("lat", String(near.lat));
    qs.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${qs}`);
  if (!res.ok) throw new Error(`Address search answered ${res.status}`);
  const json = await res.json();
  return (json.features ?? []).map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }) => {
    const p = f.properties;
    const parts = [p.name, p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.district ?? p.locality, p.city, p.state]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return { label: parts.join(", "), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
  });
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function directionsUrl(from: LatLng, to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}
