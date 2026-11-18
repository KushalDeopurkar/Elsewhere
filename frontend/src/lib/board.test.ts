import { describe, expect, it } from "vitest";
import { boardRows, pages, rowFor } from "./board";
import type { Event } from "./types";

// Thu 19 Nov 2026, 18:00 IST
const NOW = Date.parse("2026-11-19T12:30:00Z");
let n = 0;
const ev = (iso: string, over: Partial<Event> = {}): Event => ({
  id: String(++n), title: `Event ${n}`, description: null, category: "music", start_time: iso, end_time: null,
  location_name: "Famous Studios", address: null, city: "Mumbai", country: "IN", lat: null, lng: null, image_url: null,
  url: null, price_min: 499, price_max: null, is_free: false, source: "t", distance_km: null, relevance: null, ...over,
});

describe("board rows", () => {
  it("labels time, status and area", () => {
    const r = rowFor(ev("2026-11-19T15:30:00Z"), "today", NOW); // 21:00 IST
    expect(r.time).toBe("21:00");
    expect(r.status).toBe("IN 3H");
    expect(r.tone).toBe("soon");
    expect(r.area).toBe("Famous Studios");
  });
  it("says ON NOW while running and FREE for free events", () => {
    expect(rowFor(ev("2026-11-19T12:00:00Z"), "today", NOW).status).toBe("ON NOW");
    expect(rowFor(ev("2026-11-19T17:30:00Z", { is_free: true, price_min: 0 }), "today", NOW).status).toBe("FREE");
  });
  it("shows the price when further out", () => {
    expect(rowFor(ev("2026-11-19T17:30:00Z"), "today", NOW).tone).toBe("price");
  });
  it("marks date-only listings ALL DAY and sorts them last", () => {
    const rows = boardRows([ev("2026-11-18T18:30:00Z"), ev("2026-11-19T16:00:00Z")], "today", NOW); // midnight IST 19th = date only
    expect(rows.map((r) => r.time)).toEqual(["21:30", "ALL DAY"]);
  });
  it("filters by tab and drops finished events", () => {
    const list = [ev("2026-11-19T08:00:00Z"), ev("2026-11-20T14:00:00Z"), ev("2026-11-21T14:00:00Z")];
    expect(boardRows(list, "today", NOW)).toHaveLength(0);
    expect(boardRows(list, "tomorrow", NOW)).toHaveLength(1);
    const wk = boardRows(list, "weekend", NOW);
    expect(wk).toHaveLength(1);
    expect(wk[0].day).toBe("SAT");
  });
  it("pages rows", () => {
    expect(pages([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
