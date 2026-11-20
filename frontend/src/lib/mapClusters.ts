/**
 * Screen-space clustering for the map. Events that would land within one
 * grid cell of each other on screen share a single numbered marker, so a
 * busy city reads as a handful of counts instead of a pile of posters.
 * Pure, so it is testable and cheap to run on every map settle.
 */

export interface ScreenPoint<T> {
  item: T;
  x: number;
  y: number;
}

export interface Cluster<T> {
  key: string;
  items: T[];
  /** Mean screen position, for placing the marker. */
  x: number;
  y: number;
}

interface Group<T> {
  key: string;
  points: ScreenPoint<T>[];
  x: number;
  y: number;
}

/**
 * Group by grid cell, then merge any two groups (single pins included) whose
 * centres sit closer than `gap` px. A grid alone splits neighbours that fall
 * either side of a cell line, which drew counts on top of each other; the
 * merge pass means no two markers overlap. Kept items always stand alone.
 */
export function gridCluster<T>(
  points: ScreenPoint<T>[],
  cell: number,
  keepAlone: (item: T) => boolean = () => false,
  gap: number = cell * 0.8,
): { singles: T[]; clusters: Cluster<T>[] } {
  const cells = new Map<string, ScreenPoint<T>[]>();
  const singles: T[] = [];
  for (const p of points) {
    if (keepAlone(p.item)) {
      singles.push(p.item);
      continue;
    }
    const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    const list = cells.get(key);
    if (list) list.push(p);
    else cells.set(key, [p]);
  }
  const centre = (pts: ScreenPoint<T>[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  let groups: Group<T>[] = [...cells.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, pts]) => ({ key, points: pts, ...centre(pts) }));

  // Merge the closest overlapping pair until none overlap. n is a few hundred
  // at most (the events in view), so the simple loop is fine.
  for (;;) {
    let best: [number, number] | null = null;
    let bestD = gap * gap;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const dx = groups[i].x - groups[j].x;
        const dy = groups[i].y - groups[j].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    const [i, j] = best;
    const pts = [...groups[i].points, ...groups[j].points];
    const merged = { key: groups[i].key < groups[j].key ? groups[i].key : groups[j].key, points: pts, ...centre(pts) };
    groups = groups.filter((_, k) => k !== i && k !== j);
    groups.push(merged);
  }

  const clusters: Cluster<T>[] = [];
  for (const g of groups) {
    if (g.points.length === 1) singles.push(g.points[0].item);
    else clusters.push({ key: g.key, items: g.points.map((p) => p.item), x: g.x, y: g.y });
  }
  return { singles, clusters };
}
