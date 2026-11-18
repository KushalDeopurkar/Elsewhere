import { afterEach, describe, expect, it, vi } from "vitest";
import { LngLat } from "maplibre-gl";
import { cityHop, isHopFrame } from "./cityHop";

type Cam = { center: LngLat; zoom: number; pitch: number; bearing: number };

function fakeMap(start: Cam) {
  let cam = { ...start };
  const frames: (Cam & { hop: boolean })[] = [];
  const el = { addEventListener() {}, removeEventListener() {} };
  const map = {
    stop() {},
    getCenter: () => cam.center,
    getZoom: () => cam.zoom,
    getPitch: () => cam.pitch,
    getBearing: () => cam.bearing,
    getCanvas: () => ({ clientWidth: 1200, clientHeight: 800 }),
    getCanvasContainer: () => el,
    jumpTo(o: { center: LngLat | [number, number]; zoom: number; pitch: number; bearing: number }, data?: unknown) {
      const c = Array.isArray(o.center) ? new LngLat(o.center[0], o.center[1]) : o.center;
      cam = { center: c, zoom: o.zoom, pitch: o.pitch, bearing: o.bearing };
      frames.push({ ...cam, hop: isHopFrame(data) });
    },
  };
  return { map, frames };
}

describe("cityHop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lifts until both cities fit, flattens the pitch mid-flight, lands exactly", () => {
    let now = 0;
    const queue: ((t: number) => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => (queue.push(f), queue.length));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { map, frames } = fakeMap({ center: new LngLat(72.8777, 19.076), zoom: 12, pitch: 60, bearing: -20 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cityHop(map as any, { center: [77.209, 28.6139], zoom: 12, pitch: 60, bearing: -20, duration: 2000 });
    while (queue.length) {
      const f = queue.shift()!;
      f(now);
      now += 16;
    }
    const mid = frames.filter((f) => f.hop);
    expect(mid.length).toBeGreaterThan(100);
    const top = Math.min(...mid.map((f) => f.zoom));
    expect(top).toBeLessThan(6.5); // Mumbai to Delhi both on screen
    expect(top).toBeGreaterThan(3.5);
    expect(Math.min(...mid.map((f) => f.pitch))).toBeLessThan(15);
    // Smooth: no big jumps in zoom between frames.
    for (let i = 1; i < mid.length; i++) expect(Math.abs(mid[i].zoom - mid[i - 1].zoom)).toBeLessThan(0.3);
    const last = frames[frames.length - 1];
    expect(last.hop).toBe(false);
    expect(last.center.lng).toBeCloseTo(77.209, 3);
    expect(last.zoom).toBe(12);
    expect(last.pitch).toBe(60);
  });
});
