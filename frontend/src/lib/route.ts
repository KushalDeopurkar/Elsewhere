/**
 * Moving along a plan's stops. Progress `t` runs from 0 (first stop) to
 * n - 1 (last stop); whole numbers sit on a stop, fractions sit on the leg
 * between two stops. Pure, for the animated plan map.
 */
export type LngLat = [number, number];

export function clampProgress(t: number, n: number): number {
  return Math.min(Math.max(t, 0), Math.max(0, n - 1));
}

/** Position at progress t along straight legs between points. */
export function pointAt(points: LngLat[], t: number): LngLat | null {
  if (!points.length) return null;
  const p = clampProgress(t, points.length);
  const k = Math.min(Math.floor(p), points.length - 1);
  if (k >= points.length - 1) return points[points.length - 1];
  const f = p - k;
  const [a, b] = [points[k], points[k + 1]];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** The route drawn so far: every stop passed, plus the point reached. */
export function pathTo(points: LngLat[], t: number): LngLat[] {
  if (points.length < 2) return [...points];
  const p = clampProgress(t, points.length);
  const out = points.slice(0, Math.floor(p) + 1);
  const end = pointAt(points, p)!;
  const last = out[out.length - 1];
  if (end[0] !== last[0] || end[1] !== last[1]) out.push(end);
  return out;
}

/** The stop the traveller is at or heading to. */
export function stopIndexAt(t: number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.round(clampProgress(t, n))));
}
