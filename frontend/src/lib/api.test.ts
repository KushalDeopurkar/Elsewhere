import { describe, expect, it } from "vitest";
import { decodeEntities } from "./text";

describe("decodeEntities", () => {
  it("decodes common and double-encoded entities", () => {
    expect(decodeEntities("Finance &amp; Tech")).toBe("Finance & Tech");
    expect(decodeEntities("A &amp;amp; B")).toBe("A & B");
    expect(decodeEntities("Rock &#39;n&#39; Roll &quot;Live&quot; &#x27;x&#x27;")).toBe("Rock 'n' Roll \"Live\" 'x'");
    expect(decodeEntities("Fish & Chips")).toBe("Fish & Chips");
  });
});

describe("sample timetable when the API is down", () => {
  it("only lists events near the chosen city, plus online ones", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
    try {
      const { searchEvents } = await import("./api");
      const mumbai = await searchEvents({ lat: 19.076, lng: 72.8777, radius_km: 40 });
      expect(mumbai.isSample).toBe(true);
      expect(mumbai.events.length).toBeGreaterThan(0);
      for (const e of mumbai.events) expect(["Mumbai", "Online"]).toContain(e.city);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
