import { describe, expect, it } from "vitest";
import { gridCluster } from "./mapClusters";

const pt = (id: string, x: number, y: number) => ({ item: id, x, y });

describe("gridCluster", () => {
  it("groups points that share a cell and leaves lone points alone", () => {
    const { singles, clusters } = gridCluster([pt("a", 10, 10), pt("b", 30, 40), pt("c", 300, 300)], 64);
    expect(singles).toEqual(["c"]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items.sort()).toEqual(["a", "b"]);
    expect(clusters[0].x).toBe(20);
  });

  it("never folds a kept item (the selected event) into a cluster", () => {
    const { singles, clusters } = gridCluster([pt("a", 10, 10), pt("sel", 12, 12), pt("b", 14, 14)], 64, (id) => id === "sel");
    expect(singles).toContain("sel");
    expect(clusters[0].items.sort()).toEqual(["a", "b"]);
  });

  it("merges neighbours split by a cell line, so markers never overlap", () => {
    // 62 and 66 fall in different 64px cells but are 4px apart.
    const { singles, clusters } = gridCluster([pt("a", 62, 10), pt("b", 66, 12), pt("c", 66, 14), pt("far", 400, 400)], 64);
    expect(singles).toEqual(["far"]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items.sort()).toEqual(["a", "b", "c"]);
  });

  it("folds a lone pin that would sit on a cluster into it", () => {
    const { singles, clusters } = gridCluster([pt("a", 30, 30), pt("b", 50, 50), pt("lone", 80, 40)], 64);
    expect(singles).toEqual([]);
    expect(clusters[0].items).toHaveLength(3);
  });

  it("leaves markers that are far enough apart as they are", () => {
    const { singles, clusters } = gridCluster([pt("a", 10, 10), pt("b", 120, 10)], 64);
    expect(singles.sort()).toEqual(["a", "b"]);
    expect(clusters).toEqual([]);
  });

  it("no two results end up closer than the gap", () => {
    const pts = Array.from({ length: 120 }, (_, i) => pt(String(i), (i * 37) % 500, (i * 53) % 400));
    const { singles, clusters } = gridCluster(pts, 64);
    const centres = [
      ...clusters.map((c) => [c.x, c.y]),
      ...singles.map((id) => { const p = pts.find((q) => q.item === id)!; return [p.x, p.y]; }),
    ];
    for (let i = 0; i < centres.length; i++)
      for (let j = i + 1; j < centres.length; j++)
        expect(Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1])).toBeGreaterThanOrEqual(64 * 0.8);
    expect(clusters.reduce((n, c) => n + c.items.length, 0) + singles.length).toBe(120);
  });
});

