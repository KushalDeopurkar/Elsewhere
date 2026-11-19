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
});
