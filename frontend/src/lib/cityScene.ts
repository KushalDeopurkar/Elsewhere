/**
 * Geometry for the 3D city hero. Pure, so it can be unit-tested without WebGL.
 * World units: 1 unit = 2 km. The city centre sits at the origin, x east,
 * z south (three.js convention: -z is "north" on screen).
 */
import type { Event } from "./types";

export const KM_PER_UNIT = 2;
export const RADIUS_UNITS = 20; // 40 km

export function project(lat: number, lng: number, center: { lat: number; lng: number }): [number, number] {
  const kx = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  const x = ((lng - center.lng) * kx) / KM_PER_UNIT;
  const z = (-(lat - center.lat) * 110.57) / KM_PER_UNIT;
  return [x, z];
}

/** Small seeded PRNG so the skyline is stable per city. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(name: string): number {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Street-light particles: points scattered along a jittered street grid,
 * denser near the centre, so it reads as a city at night from above.
 * Returns xyz triples and a 0..1 brightness per point.
 */
export function cityLights(seed: number, count = 7000): { positions: Float32Array; glow: Float32Array } {
  const r = rng(seed);
  const positions = new Float32Array(count * 3);
  const glow = new Float32Array(count);
  const streets = 46;
  for (let i = 0; i < count; i++) {
    // Distance from centre biased inwards (sqrt of a squared draw).
    const d = RADIUS_UNITS * Math.pow(r(), 1.7);
    const ang = r() * Math.PI * 2;
    let x = Math.cos(ang) * d;
    let z = Math.sin(ang) * d;
    // Snap to a street grid so lights line up into roads. Each wedge of the
    // city gets its own grid angle, and some lights stay loose, so it reads
    // as neighbourhoods rather than one chessboard.
    const sector = Math.floor((ang / (Math.PI * 2)) * 5);
    const rot = sector * 0.37 + (seed % 7) * 0.05;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    let u = x * cos + z * sin;
    let v = -x * sin + z * cos;
    const step = (RADIUS_UNITS * 2) / (streets + sector * 4);
    const pick = r();
    if (pick < 0.4) u = Math.round(u / step) * step + (r() - 0.5) * 0.1;
    else if (pick < 0.8) v = Math.round(v / step) * step + (r() - 0.5) * 0.1;
    x = u * cos - v * sin;
    z = u * sin + v * cos;
    positions[i * 3] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;
    glow[i] = Math.min(0.95, 0.2 + 0.7 * (1 - d / RADIUS_UNITS) * r() + 0.1 * r());
  }
  return { positions, glow };
}

export interface Beacon {
  event: Event;
  x: number;
  z: number;
  /** Beam height: events starting sooner stand taller. */
  h: number;
}

export function beacons(events: Event[], center: { lat: number; lng: number }, now: number): Beacon[] {
  const out: Beacon[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.lat == null || e.lng == null) continue;
    // Many venues geocode to the same point; nudge duplicates apart.
    const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    let [x, z] = project(e.lat, e.lng, center);
    if (seen.has(key)) {
      x += ((e.id.charCodeAt(0) % 7) - 3) * 0.08;
      z += ((e.id.charCodeAt(e.id.length - 1) % 7) - 3) * 0.08;
    }
    seen.add(key);
    if (Math.hypot(x, z) > RADIUS_UNITS * 1.1) continue;
    const hours = (Date.parse(e.start_time) - now) / 3_600_000;
    const h = hours <= 0 ? 3.2 : hours <= 24 ? 2.6 : hours <= 72 ? 1.8 : 1.1;
    out.push({ event: e, x, z, h });
  }
  return out;
}
