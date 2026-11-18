"use client";

/**
 * A smooth camera hop between cities.
 *
 * MapLibre's flyTo can't change pitch along the way, and at a steep pitch the
 * zoomed-out middle of the flight asks for tiles all the way to the horizon,
 * which haven't loaded yet, so the map flashes black. This drives the camera
 * frame by frame instead:
 *
 * - centre and zoom follow the van Wijk & Nuij "optimal path" (the same
 *   maths flyTo uses), lifting just high enough that both cities fit on
 *   screen, so the whole route is visible at the top of the arc;
 * - pitch dips towards top-down mid-flight and settles back on arrival, so
 *   the low-zoom view needs only a handful of tiles;
 * - frames carry `{ eeHop: true }`, so moveend listeners can skip the
 *   per-frame events and only react when the hop lands.
 */
import { MercatorCoordinate, type MapLibreMap } from "maplibre-gl";

export interface HopTarget {
  center: [number, number]; // lng, lat
  zoom: number;
  pitch: number;
  bearing: number;
  duration?: number;
}

/** Event data on the per-frame camera updates of a hop. */
export const HOP_EVENT = { eeHop: true } as const;
export const isHopFrame = (e: unknown) => !!(e as { eeHop?: boolean } | undefined)?.eeHop;

const TILE = 512;
// Gentle at both ends without a rushed middle.
const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

const active = new WeakMap<MapLibreMap, () => void>();

export function cityHop(map: MapLibreMap, to: HopTarget): () => void {
  active.get(map)?.();
  map.stop();

  const c0 = map.getCenter();
  const z0 = map.getZoom();
  const p0 = map.getPitch();
  const b0 = map.getBearing();
  const m0 = MercatorCoordinate.fromLngLat(c0);
  const m1 = MercatorCoordinate.fromLngLat(to.center);
  const dx = m1.x - m0.x;
  const dy = m1.y - m0.y;
  const canvas = map.getCanvas();
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;

  // Distances in screen pixels at the starting zoom.
  const s0 = TILE * Math.pow(2, z0);
  const u1 = Math.hypot(dx, dy) * s0;
  const w0 = Math.max(w, h);
  const w1 = w0 / Math.pow(2, to.zoom - z0);

  // Peak: both ends on screen with a margin.
  const fitZoom = z0 + Math.log2(Math.min(w, h) / (u1 * 1.35 || 1));
  const peak = Math.min(fitZoom, z0, to.zoom);
  const wMax = w0 / Math.pow(2, peak - z0);
  const rho = u1 > 1 ? Math.min(3, Math.max(1, Math.sqrt((wMax / u1) * 2))) : 1.42;
  const rho2 = rho * rho;

  const rFor = (i: 0 | 1) => {
    const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b);
  };

  let r0 = 0;
  let S: number;
  let wAt: (s: number) => number;
  let uAt: (s: number) => number;
  if (u1 < 1e-6 || !Number.isFinite(rFor(0))) {
    // Same place: just zoom.
    const k = w1 < w0 ? -1 : 1;
    S = Math.abs(Math.log(w1 / w0)) / rho || 0;
    wAt = (s) => Math.exp(k * rho * s);
    uAt = () => 0;
  } else {
    r0 = rFor(0);
    S = (rFor(1) - r0) / rho;
    wAt = (s) => Math.cosh(r0) / Math.cosh(r0 + rho * s);
    uAt = (s) => (w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2)) / u1;
  }

  let dBearing = ((to.bearing - b0 + 540) % 360) - 180;
  if (Math.abs(dBearing) < 0.01) dBearing = 0;
  const duration = to.duration ?? 2000;
  let raf = 0;
  let t0 = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    off();
    active.delete(map);
  };
  const land = () => {
    finish();
    // A plain jump so moveend listeners see the arrival.
    map.jumpTo({ center: to.center, zoom: to.zoom, pitch: to.pitch, bearing: to.bearing });
  };

  // Any touch, drag or wheel from the person hands the camera back.
  const interrupt = () => finish();
  const container = map.getCanvasContainer();
  const events = ["pointerdown", "wheel", "touchstart"] as const;
  events.forEach((n) => container.addEventListener(n, interrupt, { passive: true }));
  const off = () => events.forEach((n) => container.removeEventListener(n, interrupt));

  const frame = (now: number) => {
    if (done) return;
    if (!t0) t0 = now;
    const k = Math.min(1, (now - t0) / duration);
    if (k >= 1) return land();
    const e = easeInOut(k);
    const s = e * S;
    const u = uAt(s);
    const zoom = z0 + Math.log2(1 / wAt(s));
    const m = new MercatorCoordinate(m0.x + dx * u, m0.y + dy * u, 0);
    // Pitch eases toward the target but dips near top-down at the high point.
    const base = p0 + (to.pitch - p0) * e;
    const pitch = base * (1 - 0.8 * Math.sin(Math.PI * e));
    map.jumpTo(
      { center: m.toLngLat(), zoom, pitch, bearing: b0 + dBearing * e },
      HOP_EVENT,
    );
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  active.set(map, finish);
  return finish;
}
