/**
 * Travel time from a starting point to a venue, from OpenStreetMap routing
 * (FOSSGIS OSRM servers) and Photon geocoding. Both are free, keyless and
 * called straight from the browser, so the viewer's location never touches
 * our server. Times are free-flow road estimates: no live traffic.
 */

export type Mode = "car" | "bike" | "foot";

export interface Leg {
  mode: Mode;
  minutes: number;
  km: number;
}

export interface TravelResult {
  legs: Leg[];
  /** Driving route as [lng, lat] pairs, for drawing on the map. */
  line: [number, number][];
}

export interface LatLng {
  lat: number;
  lng: number;
}

const BASE = "https://routing.openstreetmap.de";
const cache = new Map<string, Promise<TravelResult>>();

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

export function travelTimes(from: LatLng, to: LatLng): Promise<TravelResult> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(",");
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
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
      return { legs: ok.map((o) => o.leg), line: ok.find((o) => o.leg.mode === "car")?.line ?? [] };
    })();
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
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
