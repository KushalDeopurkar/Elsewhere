/**
 * A rough outline of India (lng, lat) for the city fly-in. It only has to
 * read as "the map of India" for two seconds of dots at altitude, so it is
 * simplified to ~70 points; not for anything cartographic.
 */
export const INDIA: [number, number][] = [
  [68.2, 23.6], [68.8, 22.3], [70.0, 21.0], [71.4, 20.8], [72.6, 21.1], [72.75, 19.0], [73.4, 16.0],
  [74.4, 14.0], [75.0, 12.0], [76.0, 10.0], [76.6, 8.9], [77.5, 8.1], [78.2, 8.9], [79.3, 10.3],
  [80.0, 12.0], [80.45, 13.5], [80.3, 15.5], [81.3, 16.4], [82.3, 17.0], [84.1, 18.3], [85.1, 19.5],
  [86.9, 20.8], [87.5, 21.6], [88.2, 21.7], [89.0, 21.9], [88.7, 24.2], [88.1, 24.6], [88.4, 25.2],
  [89.0, 25.3], [89.8, 25.6], [90.4, 25.2], [91.6, 24.1], [92.2, 23.6], [92.6, 22.0], [93.3, 23.0],
  [94.3, 24.0], [95.0, 26.0], [96.0, 27.0], [97.0, 27.8], [95.5, 28.2], [94.0, 27.5], [92.0, 26.9],
  [89.8, 26.4], [88.8, 27.3], [88.1, 26.5], [85.8, 26.6], [84.1, 27.5], [83.3, 27.4], [81.0, 28.8],
  [80.1, 28.8], [80.8, 30.2], [79.0, 31.3], [78.7, 32.5], [79.5, 33.0], [78.0, 35.3], [77.0, 35.6],
  [75.8, 36.8], [74.5, 37.0], [73.8, 36.0], [74.3, 34.7], [73.9, 34.0], [74.6, 32.6], [75.3, 32.3],
  [74.6, 31.0], [73.9, 30.2], [73.3, 29.5], [72.0, 28.0], [70.6, 28.0], [69.6, 27.2], [70.2, 26.0],
  [71.0, 24.4], [69.5, 24.3],
];

export function insideIndia(lng: number, lat: number, poly: [number, number][] = INDIA): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Dot-matrix India: a grid of [lng, lat] points inside the outline, plus the outline itself. */
export function indiaDots(step = 0.55): { fill: [number, number][]; edge: [number, number][] } {
  const fill: [number, number][] = [];
  for (let lat = 6; lat <= 37.5; lat += step) {
    // Offset alternate rows for a softer, hex-like pattern.
    const shift = Math.round((lat - 6) / step) % 2 ? step / 2 : 0;
    for (let lng = 68; lng <= 97.5; lng += step) {
      if (insideIndia(lng + shift, lat)) fill.push([lng + shift, lat]);
    }
  }
  const edge: [number, number][] = [];
  for (let i = 0; i < INDIA.length; i++) {
    const [ax, ay] = INDIA[i];
    const [bx, by] = INDIA[(i + 1) % INDIA.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25));
    for (let k = 0; k < n; k++) edge.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return { fill, edge };
}
