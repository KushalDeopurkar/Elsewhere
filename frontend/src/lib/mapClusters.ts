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

export function gridCluster<T>(
  points: ScreenPoint<T>[],
  cell: number,
  keepAlone: (item: T) => boolean = () => false,
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
  const clusters: Cluster<T>[] = [];
  for (const [key, list] of cells) {
    if (list.length === 1) {
      singles.push(list[0].item);
      continue;
    }
    clusters.push({
      key,
      items: list.map((p) => p.item),
      x: list.reduce((s, p) => s + p.x, 0) / list.length,
      y: list.reduce((s, p) => s + p.y, 0) / list.length,
    });
  }
  return { singles, clusters };
}
